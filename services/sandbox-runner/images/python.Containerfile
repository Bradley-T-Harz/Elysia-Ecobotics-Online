# BASE_IMAGE must be a reviewed python:3.12-alpine reference pinned by sha256 digest.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
USER 0
RUN rm -rf \
      /bin/* \
      /sbin/* \
      /usr/bin/* \
      /usr/sbin/* \
      /usr/local/bin/pip* \
      /usr/local/bin/idle* \
      /usr/local/lib/python3.12/ensurepip \
      /usr/local/lib/python3.12/site-packages/pip* \
      /usr/local/lib/python3.12/site-packages/setuptools* \
      /root/.cache \
  && test -x /usr/local/bin/python3.12
USER 65534:65534
WORKDIR /workspace
ENTRYPOINT []
CMD ["python", "-I", "-B", "-"]
