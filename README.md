# ccresume

Claude Codeの会話履歴を閲覧・再開するためのCUIツール

![ccresume screenshot](docs/images/demo-screenshot.png)

**⚠️ 免責事項: これはAnthropicとは無関係な非公式のサードパーティツールです。自己責任でご使用ください。**

## 概要

ccresumeは、Claude Codeの会話履歴を閲覧・管理するためのインタラクティブなターミナルインターフェースを提供します。ローカルのClaude Code設定から会話データを読み取り、ナビゲートしやすい形式で表示します。

### 主な機能

- 📋 プロジェクト全体のClaude Code会話を閲覧
- 🔍 会話の詳細情報を表示
- 📎 セッションIDをクリップボードにコピー
- 🚀 選択したプロジェクトディレクトリで新しいClaudeセッションを開始
- 📁 `.`引数でカレントディレクトリの会話のみをフィルタ
- 🎭 特定のメッセージタイプを非表示にして見やすく表示
- ⚙️ セッション開始前にClaudeコマンドオプションを対話的に編集
- 🔄 完全な会話ビューで全メッセージ履歴を表示

![ccresume demo](docs/images/demo.gif)

## 開発環境のセットアップ

### 必要な環境

- **Node.js** >= 18
- **Claude Code** - インストールと設定が必要
- **npm** または **yarn**

### リポジトリのクローン

```bash
git clone https://github.com/shin902/ccresume.git
cd ccresume
```

### 依存パッケージのインストール

```bash
npm install
```

または

```bash
yarn install
```

## 開発

### 利用可能なスクリプト

```bash
# 開発モードで実行
npm run dev

# プロジェクトをビルド
npm run build

# テストを実行
npm test

# テストをウォッチモードで実行
npm run test:watch

# テストカバレッジを生成
npm run test:coverage

# リンターを実行
npm run lint

# 型チェックを実行
npm run typecheck
```

### 開発ワークフロー

1. **コードの変更**
   - `src/` ディレクトリ内のソースコードを編集

2. **開発モードで実行**
   ```bash
   npm run dev
   ```
   このコマンドは、ソースコードを監視し、変更があれば自動的にリビルドします。

3. **型チェック**
   ```bash
   npm run typecheck
   ```
   TypeScriptの型エラーがないことを確認します。

4. **リンターの実行**
   ```bash
   npm run lint
   ```
   コードスタイルとベストプラクティスに従っているか確認します。

5. **テストの実行**
   ```bash
   npm test
   ```
   または、ウォッチモードで：
   ```bash
   npm run test:watch
   ```

6. **ビルド**
   ```bash
   npm run build
   ```
   `dist/` ディレクトリに本番用のビルドが生成されます。

### プロジェクト構造

```
ccresume/
├── src/                    # ソースコード
│   ├── cli.tsx             # CLIエントリーポイント
│   ├── App.tsx             # メインアプリケーションコンポーネント
│   ├── components/         # Reactコンポーネント
│   ├── hooks/              # カスタムReact Hooks
│   ├── utils/              # ユーティリティ関数
│   └── types/              # TypeScript型定義
├── dist/                   # コンパイル済み出力（ビルド後）
├── tests/                  # テストファイル
├── docs/                   # ドキュメントとスクリーンショット
├── package.json            # プロジェクト設定
├── tsconfig.json           # TypeScript設定
└── vitest.config.ts        # テスト設定
```

### ローカルでのテスト

ビルド後、ローカルでテストするには：

```bash
# ビルド
npm run build

# ローカルでリンク
npm link

# ccresumeコマンドを実行
ccresume
```

または、ビルドせずに直接実行：

```bash
npm run dev
```

## コントリビューション

コントリビューション歓迎です！プルリクエストをお気軽に提出してください。

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを開く

## 使い方（クイックリファレンス）

### インストール

#### npx経由（推奨）

```bash
npx @sasazame/ccresume@latest
```

#### グローバルインストール

```bash
npm install -g @sasazame/ccresume
```

### 基本的な使い方

```bash
# 会話履歴を閲覧
ccresume

# カレントディレクトリの会話のみ表示
ccresume .

# 特定のメッセージタイプを非表示
ccresume --hide tool thinking

# Claudeにオプションを渡す
ccresume --model opus --dangerously-skip-permissions
```

### キーボードショートカット

| 操作 | キー |
|------|------|
| 終了 | `q` |
| 前の項目を選択 | `↑` |
| 次の項目を選択 | `↓` |
| 確定/再開 | `Enter` |
| 新規セッション開始 | `n` |
| コマンドオプション編集 | `-` |
| セッションIDコピー | `c` |
| 上スクロール | `k` |
| 下スクロール | `j` |
| ページアップ | `u`, `PageUp` |
| ページダウン | `d`, `PageDown` |
| 先頭へ | `g` |
| 末尾へ | `G` |
| 次ページ | `→`|
| 前ページ | `←` |
| 完全表示切替 | `f` |

### カスタムキーバインディング

設定ファイルの場所（優先順）：

1. `${CLAUDE_CONFIG_DIR}/config.toml` (`CLAUDE_CONFIG_DIR`環境変数が設定されている場合)
2. `${XDG_CONFIG_HOME}/ccresume/config.toml` (`XDG_CONFIG_HOME`環境変数が設定されている場合)
3. `~/.config/ccresume/config.toml` (デフォルト)

設定例は `config.toml.example` を参照してください。

## ライセンス

MIT

## サポート

問題や機能リクエストは、[GitHub issue tracker](https://github.com/shin902/ccresume/issues) をご利用ください。

## 🐞 既知の問題

既知の問題と制限事項です。コントリビューションと提案を歓迎します！

| No. | タイトル | 説明 | Issue |
|:---:|:---------|:-----|:------|
| 1 | **再開時の会話履歴が不完全** | ccresumeで再開すると、履歴の末尾部分のみが復元されることがあります。対話的な`claude -r`では完全な履歴を復元可能。回避策: `claude -r`を対話的に使用するか、`claude -c`を使用。 | [#2](https://github.com/sasazame/ccresume/issues/2) |
| 2 | **~~終了後のコンソール状態の復元~~** | ~~`ccresume`を終了すると、チャット選択インターフェースが表示されたままで、以前のターミナル内容が隠れる。~~ **v0.3.1で修正済み**: ターミナルのスクロールバックバッファが保持されるようになりました。 | [#3](https://github.com/sasazame/ccresume/issues/3) |
| 3 | **再開順序が不正確な可能性** | パフォーマンスのため、`ccresume`はファイルシステムのタイムスタンプでログをソートします（チャット内容ではない）。そのため、マイグレーション後は表示順序が実際の時系列と一致しない場合があります。回避策: ファイルタイムスタンプを保持。 | – |
| 4 | **Windows ネイティブターミナルの制限** | Windowsネイティブターミナルでは、ターミナル入力処理の違いにより、対話機能が制限される場合があります。現在、Windows ネイティブ環境では起動前に警告メッセージが表示されます。 | [#32](https://github.com/sasazame/ccresume/issues/32) |

**注意**: これは非公式ツールです。公式のClaude Codeサポートについては、Anthropicのドキュメントを参照してください。

---

## 技術スタック

- **TypeScript** - 型安全性
- **React (Ink)** - ターミナルUI
- **Vitest** - テストフレームワーク
- **ESLint** - コード品質
- **TOML** - 設定ファイル形式
