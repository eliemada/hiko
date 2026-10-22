# Hikō · 飛行日誌

**日本で飛行するドローン操縦者向けの、セルフホスト型飛行記録アプリです。**

DJI の飛行ログを取り込み、内容を確認して署名し、国土交通省の様式1に沿った日英併記の PDF・Excel を出力できます。操作画面は主に英語です。

[English](README.md) · **[デモを試す](https://eliemada.github.io/hiko/)** · [PDF サンプル](demo/assets/sample-signed.pdf) · [Excel サンプル](demo/assets/sample-signed.xlsx)

![架空の飛行データを使った Hikō のデモ画面](docs/media/demo-review.png)

## 主な機能

- 対応する DJI Fly の TXT ログを取り込み、離着陸時刻と飛行時間を抽出します。
- 手動入力にも対応しており、DJI API キーなしで飛行を記録できます。
- 飛行目的、安全に影響した事項、機体ごとの累積飛行時間を管理します。
- 内容確認後に署名を付け、署名済みの記録をロックします。
- 表紙付き PDF と、国土交通省のテンプレートを使用した Excel を出力します。
- Docker または Node.js で、自分のサーバーに導入できます。

**公開ベータ版です。** 国土交通省や DJI の公式製品ではありません。対象は **様式1の飛行記録**です。様式2・3の日常点検記録と点検整備記録、飛行許可・承認、DIPS への通報は別途対応が必要です。自動入力された内容は操縦者自身で確認してください。[国土交通省の案内・書式](https://www.mlit.go.jp/koku/operation.html)

## 導入

Node.js 24 LTS と Docker Compose v2 を使用します。Node.js をホストに入れない方法は[導入ガイド](docs/self-hosting.md#without-nodejs-on-the-host)を参照してください。

```bash
git clone https://github.com/eliemada/hiko.git
cd hiko
node scripts/setup.mjs --docker
docker compose pull
docker compose up -d --wait
```

http://localhost:3000 を開き、最初のアカウントを作成します。このアカウントが管理者になります。初期設定では localhost にバインドします。外部公開の前に HTTPS と `BETTER_AUTH_URL` を設定してください。

**1つのインスタンスは、信頼できる1つのチーム向けです。** メンバーは機体、飛行記録、操縦者一覧などを共有します。利用者ごとに記録が隔離されるサービスではありません。

必要に応じて `.env` に `DJI_API_KEY` を設定してください。暗号化されたログの初回解析にはキーが必要です。キーがない場合、取得できるヘッダー情報のみを取り込み、時刻は推定値として扱います。

[導入・バックアップ](docs/self-hosting.md) · [プライバシー](PRIVACY.md) · [対応範囲と制限](docs/compatibility.md)

## 開発・協力

```bash
npm ci
npm run setup:local
npm run dev
```

不具合や機体ごとの動作結果は [Issues](https://github.com/eliemada/hiko/issues/new/choose) へお寄せください。元のログ、実際の位置情報、製造番号、署名、API キーを公開しないでください。デモと公開サンプルはすべて架空のデータです。

オリジナルのコードは [MIT ライセンス](LICENSE)です。同梱資料には[それぞれの利用条件](THIRD_PARTY_NOTICES.md)が適用されます。
