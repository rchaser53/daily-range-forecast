# daily-range-forecast

株探URLから銘柄コードを取り出し、J-Quants APIの日足OHLCVを使って日本株のチャートを表示するNode.jsアプリです。株探のページ自体はスクレイピングしません。

## Features

- 株探URLから証券コードを抽出
- J-Quants APIから日足OHLCVを取得
- ローソク足と出来高を表示
- SMA 5 / 25 / 75
- Pivot High / Lowを利用した支持線・抵抗線の自動検出

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

## Test

```bash
npm test
```

## Support / resistance

日足からPivot High / Lowを抽出し、価格差が既定で1.5%以内のPivotを同一ゾーンとしてまとめます。2回以上接触したゾーンを支持線または抵抗線として表示します。
