FROM ubuntu:20.04 AS alegoria-source

ARG DEBIAN_FRONTEND=noninteractive
ARG ALEGORIA_REPOSITORY=https://github.com/VCityTeam/alegoria4agape.git
ARG ALEGORIA_BRANCH=latest-itowns

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/src

RUN git clone --branch "${ALEGORIA_BRANCH}" "${ALEGORIA_REPOSITORY}" alegoria4agape


FROM node:22-bookworm-slim AS itowns-vendor

# The iTowns release served to the browser. Bump this to move to a newer
# upstream release; nothing else in the project pins an iTowns version.
ARG ITOWNS_VERSION=2.46.0

WORKDIR /opt/itowns

COPY package.json package-lock.json ./
COPY scripts ./scripts

RUN npm install --no-audit --no-fund "itowns@${ITOWNS_VERSION}" \
    && node scripts/vendor-itowns.mjs


FROM ubuntu:20.04 AS micmac-builder

ARG DEBIAN_FRONTEND=noninteractive
ARG MICMAC_REPOSITORY=https://github.com/VCityTeam/micmac4agape.git
ARG MICMAC_BUILD_PARALLEL=4

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        cmake \
        exiv2 \
        git \
        imagemagick \
        libimage-exiftool-perl \
        libx11-dev \
        make \
        proj-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/src

RUN git clone "${MICMAC_REPOSITORY}" micmac4agape \
    && cmake -S micmac4agape -B micmac4agape/build \
    && cmake --build micmac4agape/build --target install --parallel "${MICMAC_BUILD_PARALLEL}"


FROM php:8.2-apache

ENV MICMAC_HOME=/opt/micmac4agape
ENV MICMAC_BIN=/opt/micmac4agape/bin
ENV PATH="${MICMAC_BIN}:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        exiv2 \
        imagemagick \
        libimage-exiftool-perl \
        libx11-6 \
        libxau6 \
        libxcb1 \
        libxdmcp6 \
        proj-bin \
    && rm -rf /var/lib/apt/lists/*

COPY --from=micmac-builder /opt/src/micmac4agape/bin/ ${MICMAC_HOME}/bin/
COPY --from=micmac-builder /opt/src/micmac4agape/binaire-aux/ ${MICMAC_HOME}/binaire-aux/
COPY --from=micmac-builder /opt/src/micmac4agape/data/ ${MICMAC_HOME}/data/
COPY --from=micmac-builder /opt/src/micmac4agape/include/ ${MICMAC_HOME}/include/
COPY --from=micmac-builder /opt/src/micmac4agape/lib/ ${MICMAC_HOME}/lib/

COPY --from=alegoria-source /opt/src/alegoria4agape/ /var/www/html/alegoria4agape/
COPY --from=itowns-vendor /opt/itowns/vendor/itowns/ /var/www/html/alegoria4agape/vendor/itowns/

RUN { \
        echo 'file_uploads = On'; \
        echo 'upload_max_filesize = 256M'; \
        echo 'post_max_size = 256M'; \
        echo 'max_file_uploads = 20'; \
        echo 'memory_limit = 1024M'; \
        echo 'max_execution_time = 0'; \
        echo 'max_input_time = 300'; \
        echo 'default_socket_timeout = 300'; \
    } > /usr/local/etc/php/conf.d/agape.ini \
    && { \
        echo '#!/bin/sh'; \
        echo 'set -e'; \
        echo 'mkdir -p /var/www/html/alegoria4agape/data /var/www/html/alegoria4agape/outputs/test/Ori-CalInit'; \
        echo 'chmod -R a+rwX /var/www/html/alegoria4agape/data /var/www/html/alegoria4agape/outputs'; \
        echo 'exec "$@"'; \
    } > /usr/local/bin/alegoria-entrypoint

RUN chmod +x /usr/local/bin/alegoria-entrypoint ${MICMAC_HOME}/bin/* \
    && mkdir -p /var/www/html/alegoria4agape/outputs/test/Ori-CalInit \
    && chown -R www-data:www-data /var/www/html/alegoria4agape

WORKDIR /var/www/html/alegoria4agape

EXPOSE 80

ENTRYPOINT ["alegoria-entrypoint"]
CMD ["apache2-foreground"]
