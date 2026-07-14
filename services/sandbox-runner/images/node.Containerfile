# BASE_IMAGE must be a reviewed node:22-alpine reference pinned by sha256 digest.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER 0
RUN rm -rf \
      /bin/* \
      /sbin/* \
      /usr/bin/* \
      /usr/sbin/* \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /usr/local/lib/node_modules/npm \
      /root/.cache \
  && test -x /usr/local/bin/node
USER 65534:65534
WORKDIR /workspace
ENTRYPOINT []
CMD ["node", "--disable-proto=delete", "main.js"]
