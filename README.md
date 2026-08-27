# alegoria4agape

This repository supports the **AGAPE** project and is based on the previous
**Alegoria** project from [`itownsResearch/alegoria`](https://github.com/itownsResearch/alegoria).
The name **alegoria4agape** reflects that relationship: this project makes use
of Alegoria's tools and code as a foundation for AGAPE.

Tools for the semi-automatic registration of historical images and their
visualisation.

![alt text](https://raw.githubusercontent.com/itownsResearch/docs/master/oldProj2.gif "Alegoria")

## Quick start (Docker)

Requires Docker with the Compose plugin.

```
git clone --recursive https://github.com/VCityTeam/alegoria4agape
cd alegoria4agape
docker compose up --build
```

Then open:

| Page | URL |
| --- | --- |
| Visualization of oriented images | http://localhost:8080/alegoria4agape/src/oriented_images.html |
| Semi-automatic registration tool | http://localhost:8080/alegoria4agape/src/globe.html |
| Lyon — oriented images | http://localhost:8080/alegoria4agape/src/lyon/oriented_images.html |
| Lyon — globe | http://localhost:8080/alegoria4agape/src/lyon/globe.html |

That's it — MicMac is built and configured for you. The first build compiles it
from source and takes a while; see [Docker in detail](#docker-in-detail) to
speed that up or to change what gets built.

## Docker in detail

Everything in this section applies to the
[Quick start](#quick-start-docker) above. You do not need any of it to run the
application.

### How the image is built

The Dockerfile uses a multi-stage build:

1. Clone `VCityTeam/alegoria4agape` recursively, including the iTowns submodule.
2. Clone and compile `VCityTeam/micmac4agape`.
3. Copy both into a PHP/Apache runtime image.
4. Configure PHP for image uploads and long-running MicMac requests.

### Where the source comes from

The application source is not copied from your local checkout during the image
build. Docker fetches it from `ALEGORIA_REPOSITORY` with `git clone
--recursive`, and MicMac from `MICMAC_REPOSITORY`.

At **runtime**, however, `docker-compose.yml` bind-mounts your local `./src`
over the copy in the image. Edits to `src/` therefore take effect on a browser
refresh, with no rebuild needed.

### MicMac and data

The container serves the PHP application with Apache and sets:

```
MICMAC_BIN=/opt/micmac4agape/bin
```

The MicMac binaries are also on `PATH`, so `globe.html` needs no further setup.

`data/` and `outputs/` are stored in Docker named volumes by default. Docker
initializes those volumes from the image content the first time they are
created, and MicMac results remain available across container restarts.

### Build arguments

The default build uses:

```
ALEGORIA_REPOSITORY=https://github.com/VCityTeam/alegoria4agape.git
MICMAC_REPOSITORY=https://github.com/VCityTeam/micmac4agape.git
MICMAC_BUILD_PARALLEL=4
```

Raise `MICMAC_BUILD_PARALLEL` to match the cores you have to shorten the first
build. You can also build against another Alegoria or MicMac fork by changing
the arguments in `docker-compose.yml` or by overriding them manually:

```
docker compose build \
  --build-arg ALEGORIA_REPOSITORY=https://github.com/VCityTeam/alegoria4agape.git \
  --build-arg MICMAC_REPOSITORY=https://github.com/VCityTeam/micmac4agape.git \
  --build-arg MICMAC_BUILD_PARALLEL=4
```

## Manual installation

Use this only if you are not running Docker. You will need `git`, an HTTP
server, and **PHP** (required by the semi-automatic registration tool), and you
must build MicMac yourself from
[`VCityTeam/micmac4agape`](https://github.com/VCityTeam/micmac4agape).

### 1. Clone the repository

The alegoria4agape Web Tools use iTowns as a submodule
([`itowns-photogrammetric-camera`](https://github.com/VCityTeam/itowns-photogrammetric-camera4agape)),
so clone recursively to get the sources and the builts:

```
git clone --recursive https://github.com/VCityTeam/alegoria4agape
```

If you cloned without `--recursive`, fetch the submodule afterwards:

```
git submodule update --init --recursive
```

### 2. Serve the files

Launch your favorite http-server from the **parent directory of the clone**, not
from the clone itself — the URLs below include the `/alegoria4agape/` prefix.

### 3. Open the application

Replace `localhost` with the host and port your server uses.

| Page | URL |
| --- | --- |
| Visualization of oriented images | http://localhost/alegoria4agape/src/oriented_images.html |
| Semi-automatic registration tool | http://localhost/alegoria4agape/src/globe.html |
| Lyon — oriented images | http://localhost/alegoria4agape/src/lyon/oriented_images.html |
| Lyon — globe | http://localhost/alegoria4agape/src/lyon/globe.html |

### 4. Configure MicMac for globe.html

- On Linux, beware that in order to create the different files (ground point etc) you will need to specify write authorization. You can set an authorization recursive for the all alegoria directory like chmod -R 777 alegoria/
- Check the launchMicMac.php to verify that it can find micmac4agape and your images (micmac inputs around line 47). You might add a path to micmac4agape bin like this at the beginning of the function terminal

    //add MicMac to global Path
    $path = '/home/myusername/micmac4agape/bin';
    putenv('PATH=' . getenv('PATH') . PATH_SEPARATOR . $path);

## City, quartier, and zone configuration

This applies to both setups.

City-specific entry points live under `src/<city>/`. Lyon currently has:

- `src/lyon/oriented_images.html`
- `src/lyon/globe.html`

Both entry points reuse the shared pages in `src/oriented_images.html` and
`src/globe.html`. The city, quartier, and zone data is centralized in
`src/config/sites.js`.

To add a new city or zone:

1. Add the city under `ALEGORIA_SITES.cities` in `src/config/sites.js`.
2. Add one or more `zones` with `positionOnGlobe`, `orientedImages`, and
   `globeImages`.
3. Optionally create `src/<city>/oriented_images.html` and
   `src/<city>/globe.html` redirect files like the Lyon ones.

You can also open a configured zone directly by adding query parameters, for
example with Docker:

| Target | URL |
| --- | --- |
| Lyon, `default` zone | http://localhost:8080/alegoria4agape/src/globe.html?city=lyon&zone=default |
| Lyon, `default` quartier | http://localhost:8080/alegoria4agape/src/oriented_images.html?city=lyon&quartier=default |

> 🇫🇷 **Documentation en français** — l'utilisation des outils de **saisie** et
> de **visualisation** est décrite dans
> [`docs/saisie-visualisation.fr.md`](docs/saisie-visualisation.fr.md).
