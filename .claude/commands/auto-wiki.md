---
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
description: "Self-expanding wiki - orchestrator that coordinates article creation, expansion, feedback, and synchronization"
---

# Auto-Wiki Orchestrator (Multi-Wiki)

自己増殖するマルチwikiのメインオーケストレータ。引数を解析し、適切なサブskillにディスパッチする。

## Usage

```
/auto-wiki [topic] --wiki [wiki-id]          # 新規wiki作成 → Phase 1 → Phase 2
/auto-wiki --wiki [wiki-id] --resume         # 前回セッションから続行 → Phase 2
/auto-wiki --wiki [wiki-id] --feedback "slug" # 記事へのフィードバック → Phase 3
/auto-wiki --wiki [wiki-id] --request "topic" # 新規記事リクエスト → Phase 4
/auto-wiki --wiki [wiki-id] --expand         # 手動で拡張サイクル実行 → Phase 2
/auto-wiki --max-agents N                    # サブエージェント数上限（デフォルト: 3）
```

## 実行手順

ユーザー入力: $ARGUMENTS

### Step 1: 引数解析

`$ARGUMENTS` を解析し、以下を判定:

1. `--wiki` フラグからwiki-idを取得（必須）
2. wikiが未作成の場合は `uv run awiki wiki create` で作成

| 条件 | Phase | ディスパッチ先 |
|------|-------|---------------|
| トピック文字列がある（フラグなし） | Phase 1→2 | `/auto-wiki-create` → `/auto-wiki-expand` |
| `--resume` フラグ | Phase 5→2 | セッション再開 → `/auto-wiki-expand` |
| `--feedback` フラグ | Phase 3 | `/auto-wiki-feedback` |
| `--request` フラグ | Phase 4 | `/auto-wiki-request` |
| `--expand` フラグ | Phase 2 | `/auto-wiki-expand` |

### Step 2: 状態確認

1. `uv run awiki wiki get {wiki-id}` でwiki情報を取得（存在しなければ作成）
2. `uv run awiki session get --wiki {wiki-id}` で現在の状態を把握
3. `uv run awiki article list --wiki {wiki-id}` で既存記事数を確認
4. `--max-agents N` が指定されていれば抽出（デフォルト: 3）

### Step 3: Phase別ディスパッチ

全サブskillに `--wiki {wiki-id}` を渡す。

#### Phase 1→2: 新規wiki作成

1. wikiが未登録なら作成:
   ```bash
   uv run awiki wiki create --id {wiki-id} --title "{タイトル}" --root-topic "{トピック}" --color "{色}"
   ```
2. `/auto-wiki-create` を `Skill` で呼び出す:
   - 引数: `{トピック} --wiki {wiki-id} --origin root`
3. 作成完了後、`/auto-wiki-sync` を `Skill` で呼び出してDB同期:
   - 引数: `--wiki {wiki-id}`
4. Phase 1完了を報告し、Phase 2へ進むか確認
5. 続行する場合、`/auto-wiki-expand` を `Skill` で呼び出す

#### Phase 2: 拡張サイクル

1. `/auto-wiki-expand` を `Skill` で呼び出す:
   - 引数: `--wiki {wiki-id} --max-agents N`
2. 完了後、`/auto-wiki-sync` を `Skill` で呼び出して同期

#### Phase 3: フィードバック

1. `/auto-wiki-feedback` を `Skill` で呼び出す:
   - 引数: `--wiki {wiki-id} "記事slug" フィードバック内容`
2. 完了後、`/auto-wiki-sync` を `Skill` で呼び出して同期

#### Phase 4: 新規記事リクエスト

1. `/auto-wiki-request` を `Skill` で呼び出す:
   - 引数: `--wiki {wiki-id} "新トピック"`
2. 完了後、`/auto-wiki-sync` を `Skill` で呼び出して同期

#### Phase 5→2: セッション再開

1. `uv run awiki session get --wiki {wiki-id}` でセッション状態を取得
2. `uv run awiki article list --wiki {wiki-id}` と `uv run awiki brainstorm list --wiki {wiki-id}` で現在のデータを取得
3. 現在の状態をサマリー表示
4. `/auto-wiki-expand` を `Skill` で呼び出す

### Step 4: セッション状態更新

各Phase完了後:
1. セッション状態を更新:
   ```bash
   uv run awiki session update --wiki {wiki-id} --phase phase_N
   ```
2. 結果サマリーを表示

## 爆発防止メカニズム

- サイクルあたり記事数上限 = `max_agents`（デフォルト3）
- スコア足切り: `interestingness_score` 0.5未満は自動却下
- セッションあたり総記事数上限: `max_total_articles`（デフォルト50）
- 重複チェック: 同一slugの候補は却下
- 類似チェック: 既存記事と意味的に重複するタイトルの候補は却下
