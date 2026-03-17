---
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
description: "Self-expanding wiki - creates interconnected HTML articles with autonomous expansion and session persistence"
---

# Auto-Wiki Skill

自己増殖するwikiを生成・拡張するスキル。ユーザーのトピックからWikipedia風HTML記事を作成し、記事間をハイパーリンクで接続、トップページにサイトグラフを表示する。

## Usage

```
/auto-wiki [topic]                  # 新規wiki作成（Phase 1→2）
/auto-wiki --resume                 # 前回セッションから続行（Phase 2）
/auto-wiki --feedback "記事slug"    # 記事へのフィードバック（Phase 3）
/auto-wiki --request "新トピック"   # 新規記事リクエスト（Phase 4）
/auto-wiki --expand                 # 手動で拡張サイクル実行（Phase 2）
/auto-wiki --max-agents N           # サブエージェント数上限（デフォルト: 3）
/auto-wiki --depth N                # 最大深度（デフォルト: 2）
```

## 実行手順

ユーザー入力: $ARGUMENTS

### Phase判定

まず現在の状態を判定する:

1. `$ARGUMENTS` にトピック文字列がある（フラグなし） → **Phase 1**: ルート記事作成 → 自動的に **Phase 2** へ
2. `--resume` フラグ → **Phase 5→2**: セッション再開して拡張続行
3. `--feedback` フラグ → **Phase 3**: フィードバック適用
4. `--request` フラグ → **Phase 4**: 新規記事リクエスト
5. `--expand` フラグ → **Phase 2**: 拡張サイクル実行

---

### Phase 1: ルート記事作成

1. プロジェクトルートを確認: `/Users/toshihideyukitake/Project/autowiki/`
2. `db/articles.json` を読み込み、既存記事があるか確認
3. ユーザー入力のトピックからslugを生成（日本語はローマ字変換、英語はkebab-case）
4. `templates/article.html` テンプレートを読み込む
5. トピックについて包括的な記事を作成:
   - 導入（太字のキーワード含む）
   - 3〜6セクション（H2）、必要に応じてサブセクション（H3）
   - 適切な箇所にMermaidダイアグラムを1つ以上含む: `<div class="mermaid-container"><pre class="mermaid">...</pre></div>`
   - 今後作成予定の関連記事へのリンクを `<a href="{{slug}}.html">` 形式で埋め込む（3〜5個）
   - リンク先は記事内の文脈に自然に組み込む
6. テンプレートのプレースホルダーを置換してHTMLを生成:
   - `{{TITLE}}`: 記事タイトル
   - `{{LANG}}`: 言語コード（デフォルト "ja"）
   - `{{UPDATED_AT}}`: 現在日時
   - `{{SUMMARY}}`: 1-2文の要約
   - `{{CONTENT}}`: 本文HTML
   - `{{TOC}}`: H2/H3から自動生成する目次 `<li><a href="#section-id">セクション名</a></li>`
   - `{{RELATED_ARTICLES}}`: リンク先記事リスト
   - `{{LINKS_TO}}`: リンク先一覧
   - `{{LINKED_FROM}}`: 被リンク一覧（初回は空）
7. `articles/{slug}.html` に書き出す
8. `db/articles.json` を更新:
   ```json
   {
     "articles": {
       "slug": {
         "id": "slug",
         "title": "記事タイトル",
         "filename": "articles/slug.html",
         "created_at": "ISO8601",
         "updated_at": "ISO8601",
         "parent_id": null,
         "depth": 0,
         "links_to": ["related-slug-1", "related-slug-2"],
         "linked_from": [],
         "summary": "要約テキスト",
         "expansion_status": "pending",
         "interestingness_score": 1.0
       }
     },
     "root_id": "slug",
     "total_count": 1
   }
   ```
9. `db/graph.json` を更新（ノード追加）
10. `db/brainstorm.json` にリンク先として言及した未作成記事を候補として追加:
    ```json
    {
      "queue": [
        {
          "proposed_slug": "related-slug",
          "proposed_title": "関連トピック",
          "parent_id": "root-slug",
          "rationale": "なぜこの記事が面白いか",
          "interestingness_score": 0.9,
          "depth": 1,
          "status": "queued"
        }
      ],
      "history": []
    }
    ```
11. `db/session.json` を更新
12. `index.html` を再生成（テンプレートから、記事一覧とグラフデータ反映）
13. Phase 1完了を報告し、Phase 2へ進むか確認

---

### Phase 2: 拡張オーケストレーション

**これが最も重要なフェーズ。**

1. DB読み込み: `db/articles.json`, `db/brainstorm.json`, `db/session.json`
2. 設定確認: `max_agents`（デフォルト3）, `max_depth`（デフォルト2）, `max_total_articles`（デフォルト50）
3. 総記事数チェック: `total_count >= max_total_articles` なら終了

4. **ブレスト**: expansion_status が "pending" の記事それぞれについて:
   - その記事の内容を読み込む
   - 3〜5個の派生記事候補をブレスト
   - 各候補に面白さスコア（0.0〜1.0）を付与
   - 深さ減衰を適用: `score × 0.8^depth`
   - スコア0.3未満は却下
   - `db/brainstorm.json` のqueueに追加

5. **優先度ソート**: queue全体を `interestingness_score` 降順でソート

6. **サブエージェント起動**: queueの上位 `max_agents` 件を取り出し、それぞれについて:
   - Agent toolでサブエージェントを起動（並列実行）
   - 各サブエージェントへの指示:
     ```
     以下の記事を作成してください:
     - タイトル: {proposed_title}
     - slug: {proposed_slug}
     - 親記事: {parent_id} (articles/{parent_id}.html)
     - 深さ: {depth}

     手順:
     1. templates/article.html テンプレートを読み込む
     2. 親記事 articles/{parent_id}.html を読み込んで文脈を理解する
     3. db/articles.json を読み込んで既存記事を把握する
     4. 記事を作成（3〜6セクション、Mermaidダイアグラム含む）
     5. 既存記事へのリンクと、新規候補記事へのリンクを含める
     6. articles/{proposed_slug}.html に書き出す
     7. 作成した記事の情報をJSON形式で報告:
        {
          "slug": "...", "title": "...", "summary": "...",
          "links_to": [...], "new_candidates": [
            {"proposed_slug": "...", "proposed_title": "...", "rationale": "...", "interestingness_score": 0.8}
          ]
        }
     ```

7. **結果収集・DB更新**:
   - 各サブエージェントの結果を収集
   - `db/articles.json` に新記事を追加
   - 親記事の `links_to` を更新、新記事の `linked_from` を設定
   - 親記事HTMLの被リンクセクションも更新
   - 新記事から提案された候補を `db/brainstorm.json` のqueueに追加
   - 処理済み候補を `history` に移動
   - 新記事の `expansion_status` を "pending" に設定
   - 親記事の `expansion_status` を "expanded" に更新
   - `db/graph.json` を再生成（全ノード・全リンク）
   - `index.html` を再生成
   - `db/session.json` を更新

8. **継続判定**:
   - 残りキュー表示、次サイクルの候補を提示
   - ユーザーに続行するか確認
   - 続行する場合、Phase 2をリピート

---

### Phase 3: フィードバック適用

1. `--feedback` で指定された記事slugまたはタイトルを特定
2. `articles/{slug}.html` を読み込む
3. `db/articles.json` から記事メタデータを取得
4. ユーザーのフィードバックに従って記事を修正
5. **リンク整合性検証**:
   - 修正後のHTMLから全 `<a href="...html">` を抽出
   - 各リンク先がDB内に存在するか確認
   - 存在しない場合、`brainstorm.json` のqueueに候補として追加
   - `links_to` / `linked_from` を更新
   - リンクが削除された場合、対応する被リンクも更新
6. `db/graph.json` 再生成
7. `index.html` 再生成
8. 修正完了を報告

---

### Phase 4: 新規記事リクエスト

1. `--request` で指定されたトピックを取得
2. `db/articles.json` から全既存記事を読み込み
3. 新トピックと関連性が高い既存記事をリストアップ（最大5件）
4. 接続候補をユーザーに提示
5. 新記事を作成（Phase 1と同様の手順だが、関連記事へのリンクを含める）
6. 既存の関連記事にも新記事へのリンクを追加（本文の適切な箇所 + footer）
7. DB更新、graph.json再生成、index.html再生成
8. 新記事を `expansion_frontier` に追加
9. Phase 2の拡張対象として登録

---

### Phase 5: セッション再開

1. `db/session.json` を読み込む
2. `db/articles.json`, `db/brainstorm.json` を読み込む
3. 現在の状態をサマリー表示:
   - 総記事数
   - 拡張待ちの記事一覧
   - キューに残っている候補数とトップ5
   - 最後に実行したフェーズ
4. Phase 2（拡張オーケストレーション）に進む

---

## 記事HTML生成ルール

### 本文構造
- 冒頭段落: トピックの定義。タイトルを `<b>` で強調
- H2セクション: 3〜6個。各セクションに `id` 属性を付与（例: `id="history"`）
- H3サブセクション: 必要に応じて
- Mermaidダイアグラム: 最低1つ。`<div class="mermaid-container"><pre class="mermaid">` で囲む
- 内部リンク: `<a href="{slug}.html">{タイトル}</a>` 形式。既存記事は通常リンク、未作成記事も同形式（作成時に実体化）
- 外部リンクは含めない（自己完結wiki）

### TOC生成
H2, H3要素から目次を自動生成。形式:
```html
<li><a href="#section-id">セクション名</a></li>
<li class="toc-h3"><a href="#subsection-id">サブセクション名</a></li>
```

### リンク管理
- `links_to`: この記事からリンクしている記事slugのリスト
- `linked_from`: この記事にリンクしている記事slugのリスト
- 双方向を常に同期する

## index.html 再生成ルール

`templates/index.html` テンプレートから生成。プレースホルダー:
- `{{LANG}}`: 言語コード
- `{{TOTAL_COUNT}}`: 総記事数
- `{{LINK_COUNT}}`: 総リンク数
- `{{ARTICLE_ROWS}}`: 記事一覧テーブル行
  ```html
  <tr>
    <td><a href="articles/{slug}.html">{title}</a></td>
    <td>{summary}</td>
    <td>{updated_at}</td>
    <td>{links_to.length + linked_from.length}</td>
  </tr>
  ```

## graph.json 構造

```json
{
  "nodes": [
    {"id": "slug", "title": "タイトル", "url": "articles/slug.html", "summary": "要約", "is_root": true}
  ],
  "links": [
    {"source": "parent-slug", "target": "child-slug"}
  ]
}
```

## 爆発防止メカニズム

- サイクルあたり記事数上限 = `max_agents`（デフォルト3）
- 深さ制限: `depth > max_depth` の候補は `interestingness_score × 0.5` に減衰
- 深さ減衰: `score × 0.8^depth`（各深さで20%減衰）
- スコア0.3未満は自動却下
- セッションあたり総記事数上限: `max_total_articles`（デフォルト50）
- 重複チェック: 同一slugの候補は却下
