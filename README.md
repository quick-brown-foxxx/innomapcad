# InnoMapCAD

A Chrome Extension (Manifest V3) that injects GIS layers -- cadastral parcels, protection zones, and building placement -- into the [4dinno.ru](https://4dinno.ru/map/) digital twin of Innopolis SEZ. Includes a FastAPI backend for server-side geo-validation with Shapely. Built for a hackathon.

## Installation

### From GitHub Releases

1. Go to the [Releases](../../releases) page and download the latest `innomapcad-extension-*.zip`
2. Unzip it to a folder
3. Open `chrome://extensions/` in Chrome
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the unzipped folder
7. Navigate to `https://4dinno.ru/map/` to use the extension

### From Source

```bash
git clone <repo-url>
cd innomapcad/extension
pnpm install
pnpm build
```

Then load `extension/dist/` as an unpacked extension using the same Chrome steps above (steps 3-7).

## Backend Setup

```bash
cd backend
uv sync
uv run uvicorn src.main:app
```

Or with Docker:

```bash
docker-compose up
```

The backend runs on `http://localhost:8000` and provides cadastral/protection zone GeoJSON and Shapely-based geo-validation.

## Note on Unsigned Extensions

Chrome will show a warning on startup about developer mode extensions. This is expected -- dismiss it. The extension only activates on `4dinno.ru/map/*` and does not run on other sites.
