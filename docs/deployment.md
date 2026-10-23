# SECRET START 公開手順

このプロジェクトはサーバー、データベース、認証、課金 API を使わない静的 Web ゲームです。`dist` フォルダーが公開物です。GitHub Pages のサブパスと共有 URL はビルド時に設定します。

## ローカル確認

Node.js 22.12 以上を使います。

```powershell
npm ci
npm test
npm run build
node scripts/verify-build.mjs
npm run preview -- --port 4173
```

`http://127.0.0.1:4173/` を開きます。`index.html` を直接開く `file://` 配信は対象外です。

## GitHub Pages

1. 自分の GitHub アカウントにリポジトリを作成し、このプロジェクト全体を追加します。無料アカウントでは公開リポジトリを使用してください。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
3. デフォルトブランチへ push するか、**Actions → Test and deploy GitHub Pages → Run workflow** を実行します。
4. テスト、静的ビルド、ファイル参照の検証が成功した後、`github-pages` 環境へデプロイされます。実際の URL は workflow の deploy ジョブに表示されます。
5. その URL で下記の公開後確認を実施します。

`.github/workflows/pages.yml` は `configure-pages` の `base_path` と `base_url` をそれぞれ `VITE_BASE_PATH`、`VITE_PUBLIC_URL` へ渡します。リポジトリ名を変更しても同じ設定を使えます。プルリクエストとデフォルト以外のブランチではテストとビルドのみ実行します。個人用アクセストークンをソースコードに保存する必要はありません。

GitHub CLI を使用する場合の例です。`OWNER` は自分のアカウント名へ置き換えます。既存リポジトリへ公開する場合は新規作成を省略してください。

```powershell
gh auth login --hostname github.com
git init -b main
git add .
git commit -m "Implement SECRET START"
gh repo create OWNER/secret-start --public --source . --remote origin --push
gh api --method POST repos/OWNER/secret-start/pages -f build_type=workflow
gh workflow run pages.yml
```

`pages` の POST が「既に存在する」と返る場合は Settings → Pages で Source を確認します。組織のポリシーやブランチ保護、環境承認がある場合は、その設定に従ってデプロイを実行してください。

## サブパスの手動ビルド

GitHub Actions 以外でビルドする場合の PowerShell 例です。URL は実際の公開先に合わせます。

```powershell
$env:VITE_BASE_PATH = '/secret-start/'
$env:VITE_PUBLIC_URL = 'https://OWNER.github.io/secret-start/'
npm run build
node scripts/verify-build.mjs
npm run preview -- --port 4173
```

`http://127.0.0.1:4173/secret-start/` を開き、画像、音、図鑑が表示されることを確認します。確認後は必要に応じて環境変数を解除します。

```powershell
Remove-Item Env:VITE_BASE_PATH -ErrorAction SilentlyContinue
Remove-Item Env:VITE_PUBLIC_URL -ErrorAction SilentlyContinue
```

画面切替は同じ HTML 内で行うため、ページごとのサーバールーティングは不要です。アセットは Vite の base を使います。

## 公開後確認

- 公開 URL のトップと末尾 `/` 付き URL を新しいタブで開き、白画面、404、画像欠落がないことを確認します。
- 幅 320 px の縦画面と横画面で、3 入力、削除、リセット、START、演出スキップを試します。
- 5 発見で図鑑、87 発見で探索一覧、173 発見で完全発見エンディングが解禁されることを確認します。未入力の当たり外れが探索一覧に出ていないことも確認します。
- 発見直後にリロードして記録が残ること、音声の消音設定、既読自動スキップの ON/OFF を確認します。
- 共有ボタンを明示的に押し、X の投稿画面に公開 URL と発見数が入ることを確認します。投稿自体を実行する必要はありません。
- 一度全体を読み込んだ後にネットワークを切断し、リロードと演出・図鑑・保存を確認します。オフラインでは X の投稿画面への接続はできません。

## この納品時の公開状況

2026 年 10 月 23 日時点で GitHub CLI の既存認証トークンが無効であることを確認しました。連携のプロフィール参照は利用できましたが、リポジトリ新規作成と Pages 設定の操作は利用できませんでした。公開リポジトリと Pages URL はこの作業では作成していません。上記 workflow と公開手順を同梱しています。

ローカル検証の実施結果は [test-plan.md](test-plan.md) に記録します。GitHub Pages の公開先での確認は公開後に実施してください。

## 公式資料

- [GitHub Pages のカスタム workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages の公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [actions/checkout](https://github.com/actions/checkout)
- [actions/setup-node](https://github.com/actions/setup-node)

2026 年 10 月 23 日に公式資料を確認し、checkout v7、setup-node v7、configure-pages v5、upload-pages-artifact v4、deploy-pages v4 を採用しました。
