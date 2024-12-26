#!/bin/bash

# SSL sertifika klasörü oluştur
mkdir -p ssl

# Self-signed sertifika oluştur
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/privkey.pem \
    -out ssl/fullchain.pem \
    -subj "/CN=35.226.91.159" \
    -addext "subjectAltName=IP:35.226.91.159"

# Dosya izinlerini ayarla
chmod 600 ssl/privkey.pem
chmod 644 ssl/fullchain.pem 