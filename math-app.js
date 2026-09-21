(function () {
  'use strict';

  var S = 'Rocio';
  var D = (typeof DATA !== 'undefined') ? DATA : window.DATA;
  var LS = 'cp3_rocio_math';

  function $(id) { return document.getElementById(id); }
  var els = {
    subjectTitle: $('subjectTitle'), subjectSub: $('subjectSub'), reviewerHost: $('reviewerHost'),
    practiceStart: $('practiceStart'), mistakeStart: $('mistakeStart'), practiceHost: $('practiceHost'),
    dailyStart: $('dailyStart'), dailyHost: $('dailyHost'), todayText: $('todayText'), resultsHost: $('resultsHost')
  };

  if (!D || !Array.isArray(D.questions)) {
    document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif">Math reviewer could not load its question data. Please refresh the page.</div>';
    return;
  }

  document.title = S + "'s Math Reviewer";
  if (els.subjectTitle) els.subjectTitle.textContent = D.icon + ' ' + S + "'s Math Adventure!";
  if (els.subjectSub) els.subjectSub.textContent = 'Hi, ' + S + '! ' + D.subtitle;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (x) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];
    });
  }
  function dateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function shuffle(a) {
    var out = a.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  function historyLoad() {
    try { return JSON.parse(localStorage.getItem(LS + '_history')) || []; }
    catch (e) { return []; }
  }
  function historySave(h) {
    try { localStorage.setItem(LS + '_history', JSON.stringify(h.slice(-50))); }
    catch (e) { }
  }
  function missesSave(ids) {
    try { localStorage.setItem(LS + '_misses', JSON.stringify(ids)); }
    catch (e) { }
  }
  function missesLoad() {
    try { return JSON.parse(localStorage.getItem(LS + '_misses')) || []; }
    catch (e) { return []; }
  }

  function reviewer() {
    if (!els.reviewerHost) return;
    els.reviewerHost.innerHTML = D.reviewer.map(function (x, i) {
      return '<article class="card"><div class="cardhead">' + (x.icon || '⭐') + ' ' + (i+1) + '. ' + esc(x.title) + '</div><div class="cardbody">' + x.html + '</div></article>';
    }).join('');
  }

  function makeSet(quotas) {
    var out = [];
    Object.keys(quotas).forEach(function (topic) {
      var quota = quotas[topic];
      var pool = shuffle(D.questions.filter(function (q) { return q.topic === topic; }));
      var chosen = [];
      var visualIndex = pool.findIndex(function (q) { return !!q.image; });
      if (quota > 0 && visualIndex >= 0) {
        chosen.push(pool.splice(visualIndex, 1)[0]);
      }
      chosen = chosen.concat(pool.slice(0, Math.max(0, quota - chosen.length)));
      out = out.concat(chosen);
    });
    return shuffle(out);
  }
  function dailySet() { return makeSet(D.dailyQuotas); }
  function practiceSet() { return makeSet(D.practiceQuotas); }
  function mistakeSet() {
    var map = {};
    D.questions.forEach(function (q) { map[q.id] = q; });
    return missesLoad().map(function (id) { return map[id]; }).filter(Boolean);
  }

  var state = null;

  function frame(host, mode, qs) {
    if (!host) return;
    if (!qs || !qs.length) {
      host.innerHTML = '<div class="empty">No questions are available for this set. Please refresh the page.</div>';
      return;
    }
    host.innerHTML = '<div class="quiz">' +
      '<div class="quiztop"><div class="status"><span id="' + mode + 'P"></span><span id="' + mode + 'S"></span></div>' +
      '<div class="progress"><div class="bar" id="' + mode + 'B"></div></div></div>' +
      '<div class="qbody" id="' + mode + 'Q"></div><div class="feedback" id="' + mode + 'F"></div>' +
      '<div class="qactions"><button type="button" class="btn secondary" id="' + mode + 'R">↻ Restart</button>' +
      '<button type="button" class="btn primary" id="' + mode + 'N" disabled>Next ➜</button></div></div>';
    state = {host:host, mode:mode, qs:qs, i:0, score:0, recs:[], lock:false};
    $(mode + 'R').addEventListener('click', function () { start(mode); });
    $(mode + 'N').addEventListener('click', next);
    render();
  }

  function start(mode) {
    var qs, host;
    if (mode === 'daily') { qs = dailySet(); host = els.dailyHost; }
    else if (mode === 'practice') { qs = practiceSet(); host = els.practiceHost; }
    else {
      qs = mistakeSet(); host = els.practiceHost;
      if (!qs.length) {
        host.innerHTML = '<div class="empty">🌟 No stored mistakes yet. Finish a quiz first.</div>';
        return;
      }
    }
    frame(host, mode, qs);
  }

  function render() {
    if (!state || !state.qs[state.i]) return;
    var q = state.qs[state.i], m = state.mode;
    state.lock = false;
    $(m + 'P').textContent = 'Question ' + (state.i + 1) + ' of ' + state.qs.length;
    $(m + 'S').textContent = 'Score: ' + state.score;
    $(m + 'B').style.width = (state.i / state.qs.length * 100) + '%';

    var h = '<span class="topic">' + esc(q.topic) + '</span><span class="difficulty">' + esc(q.difficulty || '') + '</span>' +
      '<div class="question">' + esc(q.q) + '</div>';

    if (q.image) {
      h += '<figure class="question-visual"><img src="' + esc(q.image) + '" alt="' + esc(q.imageAlt || 'Math geometry diagram') + '" loading="lazy">' +
        (q.caption ? '<figcaption class="question-caption">' + esc(q.caption) + '</figcaption>' : '') +
        '</figure>';
    }

    if (q.type === 'text') {
      h += '<div class="textrow"><input type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" id="' + m + 'I" aria-label="Type your answer" placeholder="Type your answer">' +
        '<button type="button" class="btn primary" id="' + m + 'C">Check</button></div>';
    } else {
      h += '<div class="answers">' + q.choices.map(function (c, i) {
        return '<button type="button" class="ans" data-i="' + i + '">' + String.fromCharCode(65+i) + '. ' + esc(c) + '</button>';
      }).join('') + '</div>';
    }

    $(m + 'Q').innerHTML = h;
    var f = $(m + 'F'); f.className = 'feedback'; f.innerHTML = '';
    $(m + 'N').disabled = true;

    if (q.type === 'text') {
      var input = $(m + 'I'), checkBtn = $(m + 'C');
      checkBtn.addEventListener('click', checkText);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); checkText(); }
      });
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
    } else {
      $(m + 'Q').querySelectorAll('.ans').forEach(function (b) {
        b.addEventListener('click', function () { choose(Number(b.getAttribute('data-i'))); });
      });
    }
  }

  function choose(i) {
    if (!state || state.lock) return;
    state.lock = true;
    var q = state.qs[state.i], ok = i === q.answer;
    state.host.querySelectorAll('.ans').forEach(function (b, j) {
      b.disabled = true;
      if (j === q.answer) b.classList.add('correct');
      if (j === i && j !== q.answer) b.classList.add('wrong');
    });
    finish(ok, q.choices[i], q.choices[q.answer]);
  }

  function norm(v) { return String(v).toLowerCase().replace(/,/g, '').trim(); }

  function checkText() {
    if (!state || state.lock) return;
    var q = state.qs[state.i], input = $(state.mode + 'I');
    if (!input) return;
    var v = input.value;
    if (!v.trim()) { input.focus(); return; }
    state.lock = true;
    input.disabled = true;
    var checkBtn = $(state.mode + 'C'); if (checkBtn) checkBtn.disabled = true;
    var answers = Array.isArray(q.answerText) ? q.answerText : [q.answerText];
    finish(answers.map(norm).indexOf(norm(v)) !== -1, v, answers[0]);
  }

  function finish(ok, your, answer) {
    var q = state.qs[state.i];
    if (ok) state.score++;
    state.recs.push({id:q.id, topic:q.topic, q:q.q, correct:ok, your:your, answer:answer});
    var f = $(state.mode + 'F');
    f.className = 'feedback ' + (ok ? 'good' : 'bad');
    f.textContent = (ok ? '✅ Correct! ' : '💡 Nice try. ') + (q.explain || '');
    $(state.mode + 'S').textContent = 'Score: ' + state.score;
    $(state.mode + 'N').disabled = false;
  }

  function next() {
    if (!state || !state.lock) return;
    state.i++;
    if (state.i < state.qs.length) render(); else done();
  }

  function done() {
    var pct = Math.round(state.score / state.qs.length * 100);
    var miss = state.recs.filter(function (x) { return !x.correct; }).map(function (x) { return x.id; });
    var h = historyLoad(), byTopic = {};
    state.recs.forEach(function (r) {
      if (!byTopic[r.topic]) byTopic[r.topic] = {right:0,total:0};
      byTopic[r.topic].total++;
      if (r.correct) byTopic[r.topic].right++;
    });
    missesSave(miss);
    h.push({date:dateKey(), mode:state.mode, score:state.score, total:state.qs.length, pct:pct, byTopic:byTopic});
    historySave(h);
    var mode = state.mode;
    state.host.innerHTML = '<div class="quiz"><div class="result"><h2>🎉 Finished!</h2><div class="score">' + state.score + '/' + state.qs.length + '</div><h2>' + pct + '%</h2>' +
      '<button type="button" class="btn primary" id="retryQuiz">Try Again</button></div></div>';
    $('retryQuiz').addEventListener('click', function () { start(mode); });
    results();
  }

  function view(id) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === id); });
    document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === id); });
    if (id === 'results') results();
  }

  function results() {
    if (!els.resultsHost) return;
    var h = historyLoad();
    if (!h.length) { els.resultsHost.innerHTML = '<div class="empty">No Math results yet.</div>'; return; }
    var a = {};
    h.forEach(function (x) {
      Object.keys(x.byTopic || {}).forEach(function (t) {
        var s = x.byTopic[t];
        if (!a[t]) a[t] = {right:0,total:0};
        a[t].right += s.right; a[t].total += s.total;
      });
    });
    els.resultsHost.innerHTML = '<table class="history"><tr><th>Date</th><th>Mode</th><th>Score</th></tr>' +
      h.slice(-8).reverse().map(function (x) { return '<tr><td>' + esc(x.date) + '</td><td>' + esc(x.mode) + '</td><td>' + x.score + '/' + x.total + ' (' + x.pct + '%)</td></tr>'; }).join('') + '</table>' +
      Object.keys(a).map(function (t) { var s=a[t], p=Math.round(s.right/s.total*100); return '<p><strong>' + esc(t) + '</strong> ' + p + '%</p><div class="meter"><span style="width:' + p + '%"></span></div>'; }).join('');
  }

  document.querySelectorAll('.nav button').forEach(function (b) {
    b.setAttribute('type','button');
    b.addEventListener('click', function () { view(b.getAttribute('data-view')); });
  });
  if (els.practiceStart) els.practiceStart.addEventListener('click', function () { start('practice'); });
  if (els.mistakeStart) els.mistakeStart.addEventListener('click', function () { start('mistakes'); });
  if (els.dailyStart) els.dailyStart.addEventListener('click', function () { start('daily'); });
  if (els.todayText) els.todayText.textContent = new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  reviewer();
  results();
})();
