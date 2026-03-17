// Auto-Wiki - Client-side Search
(function() {
  'use strict';

  const DB_URL = 'db/articles.json';
  let articlesData = null;

  function init(inputId, resultsId) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    // Load article data
    fetch(DB_URL)
      .then(r => r.json())
      .then(data => { articlesData = data; })
      .catch(err => console.error('Search data load error:', err));

    // Search on input
    input.addEventListener('input', debounce(function() {
      const query = this.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '';
        return;
      }
      performSearch(query, results);
    }, 200));
  }

  function performSearch(query, container) {
    if (!articlesData || !articlesData.articles) {
      container.innerHTML = '<p>データを読み込み中...</p>';
      return;
    }

    const articles = Object.values(articlesData.articles);
    const scored = articles.map(article => {
      let score = 0;
      const titleLower = (article.title || '').toLowerCase();
      const summaryLower = (article.summary || '').toLowerCase();

      if (titleLower === query) score += 100;
      else if (titleLower.includes(query)) score += 50;
      if (summaryLower.includes(query)) score += 20;

      return { article, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

    if (scored.length === 0) {
      container.innerHTML = '<p class="result-item">該当する記事が見つかりません</p>';
      return;
    }

    container.innerHTML = scored.map(({ article }) => `
      <div class="result-item">
        <a href="${article.filename}" class="result-title">${escapeHtml(article.title)}</a>
        <div class="result-summary">${escapeHtml(article.summary || '')}</div>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  window.AutoWikiSearch = { init: init };
})();
