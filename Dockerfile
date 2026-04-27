FROM ubuntu:latest
LABEL authors="nielst"

ENTRYPOINT ["top", "-b"]