# alegoria4agape

This repository supports the **AGAPE** project and is based on the previous
**Alegoria** project from [`itownsResearch/alegoria`](https://github.com/itownsResearch/alegoria).
The name **alegoria4agape** reflects that relationship: this project makes use
of Alegoria's tools and code as a foundation for AGAPE.

Tools for the semi-automatic registration of historical images and their
visualisation.

![alt text](https://raw.githubusercontent.com/itownsResearch/docs/master/oldProj2.gif "Alegoria")

> 🇫🇷 **Documentation en français** — l'utilisation des outils de **saisie** et
> de **visualisation** est décrite dans
> [`docs/saisie-visualisation.fr.md`](docs/saisie-visualisation.fr.md).

There are two ways to run the application. Pick **one** and follow it through:
[Docker](#quick-start-docker) (recommended) or a
[manual installation](#manual-installation).

## Requirements

| Setup | Needs |
| --- | --- |
| Docker | Docker with the Compose plugin (`docker compose`) |
| Manual installation | `git`, an HTTP server, and **PHP** (required by the semi-automatic registration tool) |

## Quick start (Docker)

This Docker setup builds a complete runtime for
[`VCityTeam/alegoria4agape`](https://github.com/VCityTeam/alegoria4agape) with
[`VCityTeam/micmac4agape`](https://github.com/VCityTeam/micmac4agape).

Build and run the web tool from this repository:

```
docker compose up --build
```

The first build compiles MicMac from source and takes a while. Adjust
`MICMAC_BUILD_PARALLEL` (see
[Docker configuration reference](#docker-configuration-reference)) to match the
cores you have available.

The application is then served at **`http://localhost:8080`** — see
[Opening the application](#opening-the-application) for the page paths.

The Dockerfile uses a multi-stage build:

1. Clone `VCityTeam/alegoria4agape` recursively, including the iTowns submodule.
2. Clone and compile `VCityTeam/micmac4agape`.
3. Copy both into a PHP/Apache runtime image.
4. Configure PHP for image uploads and long-running MicMac requests.

## Manual installation

The alegoria4agape Web Tools use iTowns as a submodule
([`itowns-photogrammetric-camera`](https://github.com/VCityTeam/itowns-photogrammetric-camera4agape))
so in order to get the sources and the builts:

```
git clone --recursive https://github.com/VCityTeam/alegoria4agape
```

If you cloned without `--recursive`, fetch the submodule afterwards:

```
git submodule update --init --recursive
```

You're done!
Now launch your favorite http-server (you'll need php for the semi-automatic
registration tool).

Serve from the **parent directory of the clone**, not from the clone itself:
the URLs below include the `/alegoria4agape/` prefix.

The application is then served at **`http://localhost`** (or whichever port your
server uses) — see [Opening the application](#opening-the-application) for the
page paths.

## Opening the application

Combine the base URL of the setup you chose with the path of the page you want:

| Setup | Base URL |
| --- | --- |
| Docker | `http://localhost:8080` |
| Manual installation | `http://localhost` (or your server's port) |

| Page | Path |
| --- | --- |
| Visualization of oriented images | `/alegoria4agape/src/oriented_images.html` |
| Semi-automatic registration tool | `/alegoria4agape/src/globe.html` |
| Lyon — oriented images | `/alegoria4agape/src/lyon/oriented_images.html` |
| Lyon — globe | `/alegoria4agape/src/lyon/globe.html` |

For example, with Docker the registration tool is at
`http://localhost:8080/alegoria4agape/src/globe.html`.

## City, quartier, and zone configuration

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

You can also open a configured zone directly, by appending the query parameters
to the paths above:

```
/alegoria4agape/src/globe.html?city=lyon&zone=default
/alegoria4agape/src/oriented_images.html?city=lyon&quartier=default
```

## Docker configuration reference

This section applies to the [Docker](#quick-start-docker) setup only.

The application source is not copied from the local checkout during the image
build. Docker fetches it from `ALEGORIA_REPOSITORY` with `git clone
--recursive`, and MicMac from `MICMAC_REPOSITORY`.

At **runtime**, however, `docker-compose.yml` bind-mounts the local `./src` over
the copy in the image. Edits to `src/` therefore take effect on a browser
refresh, with no rebuild needed.

The container serves the PHP application with Apache and sets:

```
MICMAC_BIN=/opt/micmac4agape/bin
```

`data/` and `outputs/` are stored in Docker named volumes by default. Docker
initializes those volumes from the image content the first time they are
created, and MicMac results remain available across container restarts.

The default build uses:

```
ALEGORIA_REPOSITORY=https://github.com/VCityTeam/alegoria4agape.git
MICMAC_REPOSITORY=https://github.com/VCityTeam/micmac4agape.git
MICMAC_BUILD_PARALLEL=4
```

You can build against another Alegoria or MicMac fork by changing the repository
arguments in `docker-compose.yml` or by overriding them manually:

```
docker compose build \
  --build-arg ALEGORIA_REPOSITORY=https://github.com/VCityTeam/alegoria4agape.git \
  --build-arg MICMAC_REPOSITORY=https://github.com/VCityTeam/micmac4agape.git \
  --build-arg MICMAC_BUILD_PARALLEL=4
```

## Running MicMac with globe.html

### With Docker

Nothing to configure: the image already compiles MicMac, sets `MICMAC_BIN`, and
puts the MicMac binaries on `PATH`.

### With a manual installation

- On Linux, beware that in order to create the different files (ground point etc) you will need to specify write authorization. You can set an authorization recursive for the all alegoria directory like chmod -R 777 alegoria/
- Check the launchMicMac.php to verify that it can find micmac4agape and your images (micmac inputs around line 47). You might add a path to micmac4agape bin like this at the beginning of the function terminal

    //add MicMac to global Path
    $path = '/home/myusername/micmac4agape/bin';
    putenv('PATH=' . getenv('PATH') . PATH_SEPARATOR . $path);
