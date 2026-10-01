# daily-range-forecast

株探URLから銘柄コードを取り出し、J-Quants APIの日足OHLCVを使って日本株のチャートを表示するNode.jsアプリです。株探のページ自体はスクレイピングしません。

## Features

- 株探URLから証券コードを抽出
- J-Quants APIから日足OHLCVを取得
- 日次 / 週次 / 月次チャートの切り替え
- ローソク足と出来高を表示
- SMA 5 / 25 / 75
- Pivot High / Lowを利用した支持線・抵抗線の自動検出

週次・月次は取得した日足OHLCVをサーバー側で集約して生成します。週足は月曜日始まり、月足は暦月単位です。

## Requirements

- Node.js 20以降（標準の `fetch` を利用）
- J-Quants API Key

## Setup

```bash
npm install
cp .env.example .env
```

`.env` にAPIキーを設定します。

```env
JQUANTS_API_KEY=your_api_key_here
PORT=3000
```

APIキーはサーバー側だけで利用し、ブラウザへは送信しません。

## Run

```bash
npm start
```

ブラウザで `http://localhost:3000` を開き、たとえば以下のURLを入力します。

```text
https://kabutan.jp/stock/kabuka?code=4689&ashi=day
```

時間足のセレクトボックスから日次・週次・月次を切り替えられます。

APIを直接利用する場合は `timeframe` に `daily` / `weekly` / `monthly` を指定できます。

```text
/api/chart?url=https%3A%2F%2Fkabutan.jp%2Fstock%2Fkabuka%3Fcode%3D4689&timeframe=weekly
```

## Test

```bash
npm test
```

## Support / resistance

選択した時間足からPivot High / Lowを抽出し、価格差が既定で1.5%以内のPivotを同一ゾーンとしてまとめます。2回以上接触したゾーンを支持線または抵抗線として表示します。


## Cache

J-QuantsのAPI呼び出し回数を抑えるため、取得済みの日足データは銘柄コードごとに `.cache/daily-bars/<code>.json` へ保存します。同じ銘柄は以後このファイルから読み込むため、サーバーを再起動しても再取得しません。

最新データをJ-Quantsから取り直したい場合は、対象銘柄のキャッシュファイルを削除してください。`.cache/` はGit管理対象外です。
