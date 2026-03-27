// Auto-Wiki - Client-side Search (multi-wiki)
(function() {
  'use strict';

  let articlesData = null;

  function init(inputId, resultsId, dbUrl, options) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    options = options || {};
    const isPortal = options.portal || false;

    if (isPortal) {
      // Portal mode: load all wikis' articles from registry
      fetch('db/registry.json')
        .then(r => r.json())
        .then(reg => {
          const wikiIds = Object.keys(reg.wikis || {}).filter(id => reg.wikis[id].status === 'active');
          return Promise.all(wikiIds.map(id =>
            fetch(`wikis/${id}/db/articles.json`)
              .then(r => r.json())
              .then(data => ({ wikiId: id, wikiInfo: reg.wikis[id], data }))
              .catch(() => null)
          ));
        })
        .then(results => {
          articlesData = { articles: {}, portal: true, wikiMap: {} };
          for (const r of results) {
            if (!r) continue;
            for (const [slug, art] of Object.entries(r.data.articles || {})) {
              const key = `${r.wikiId}:${slug}`;
              articlesData.articles[key] = {
                ...art,
                _wiki: r.wikiId,
                _wikiTitle: r.wikiInfo.title,
                _color: r.wikiInfo.color,
                filename: `wikis/${r.wikiId}/articles/${slug}.html`,
              };
            }
          }
        })
        .catch(err => console.error('Portal search data load error:', err));
    } else {
      // Single-wiki mode
      dbUrl = dbUrl || 'db/articles.json';
      fetch(dbUrl)
        .then(r => r.json())
        .then(data => { articlesData = data; })
        .catch(err => console.error('Search data load error:', err));
    }

    // Search on input
    input.addEventListener('input', debounce(function() {
      const query = this.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '';
        return;
      }
      performSearch(query, results, isPortal);
    }, 200));
  }

  function performSearch(query, container, isPortal) {
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

    container.innerHTML = scored.map(({ article }) => {
      const wikiTag = isPortal && article._wikiTitle
        ? `<span class="result-wiki" style="color:${article._color||'#666'}">[${escapeHtml(article._wikiTitle)}]</span> `
        : '';
      return `
        <div class="result-item">
          <a href="${article.filename}" class="result-title">${wikiTag}${escapeHtml(article.title)}</a>
          <div class="result-summary">${escapeHtml(article.summary || '')}</div>
        </div>
      `;
    }).join('');
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
