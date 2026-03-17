# Auto-Wiki

自己増殖するwikiを生成する Claude Code Skill。ブレスト・リサーチ・要件定義などの知的タスクに活用できます。

## 特徴

- **Wikipedia風HTML記事**: 白基調のシンプルなデザイン、Mermaidダイアグラム対応
- **自己増殖**: 記事から派生トピックを自動でブレスト・生成
- **サイトグラフ**: D3.js力指向グラフで記事の繋がりを可視化
- **セッション永続化**: 中断しても次回セッションで続行可能
- **GitHub Pages対応**: pushするだけでwikiを公開

## セットアップ

### 前提条件

- [Claude Code](https://claude.ai/claude-code) がインストール済みであること

### 手順

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/YOUR_USERNAME/autowiki.git
   cd autowiki
   ```

2. Claude Code を起動:
   ```bash
   claude
   ```

3. Auto-Wiki を実行:
   ```
   /auto-wiki 人工知能
   ```

## 使い方

### 新規wiki作成
```
/auto-wiki "トピック名"
```
トピックに関するルート記事を作成し、派生記事の自動拡張を開始します。

### 拡張の続行
```
/auto-wiki --resume
```
前回のセッションから記事の拡張を続行します。

### 記事へのフィードバック
```
/auto-wiki --feedback "article-slug"
```
指定した記事に対してフィードバックを適用します。

### 新規記事のリクエスト
```
/auto-wiki --request "新しいトピック"
```
既存記事との関連性を考慮しながら新しい記事を追加します。

### オプション
- `--max-agents N`: 同時サブエージェント数（デフォルト: 3）
- `--depth N`: 最大展開深度（デフォルト: 2）

## GitHub Pages でデプロイ

1. GitHubにリポジトリを作成してpush
2. Settings > Pages > Source で「GitHub Actions」を選択
3. 自動でデプロイされます

## プロジェクト構造

```
autowiki/
├── index.html              # トップページ（サイトグラフ）
├── articles/               # 生成された記事HTML
├── assets/
│   ├── css/wiki.css        # Wikipedia風テーマ
│   └── js/
│       ├── graph.js        # D3.js力指向グラフ
│       └── search.js       # 検索機能
├── templates/              # HTMLテンプレート
├── db/                     # JSONデータベース
│   ├── articles.json       # 記事メタデータ
│   ├── brainstorm.json     # ブレスト履歴・キュー
│   ├── graph.json          # グラフデータ
│   └── session.json        # セッション状態
└── .claude/commands/
    └── auto-wiki.md        # Skill定義
```

## 技術スタック

| 項目 | 技術 |
|------|------|
| 記事 | 静的HTML |
| ダイアグラム | Mermaid.js (CDN) |
| サイトグラフ | D3.js 力指向グラフ |
| スタイル | Wikipedia風CSS |
| データベース | JSON ファイル |
| デプロイ | GitHub Pages + Actions |
| AI | Claude Code (Agent/Task) |
