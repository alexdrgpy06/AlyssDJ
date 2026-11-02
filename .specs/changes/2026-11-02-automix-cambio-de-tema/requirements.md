---
change: 2026-11-02-automix-cambio-de-tema
type: fix
domains: [automix]
paths: [renderer/automix.js, scripts/test-automix-add.js]
commits: []
status: approved
rev: 1
approved_rev: 1
approved_hash: 2ae00a450e944a51a45396756733f948a9a87ef2b74af847316ea28791917a6d
approved_by: Alejandro Ramirez
approved_at: 2026-11-02
---
# Requirements · 2026-11-02-automix-cambio-de-tema

## Contexto

Al iniciar el AutoMix con otro tema (por ejemplo «Radio» desde una pista de la librería) mientras ya había uno en marcha, `start()` solo detenía el temporizador: la otra pista seguía sonando, a veces a medio mezclar con el EQ y el filtro cambiados, y la cola, la radio y el plan del tema anterior quedaban en memoria.

## Requisitos

### REQ-1: Parar lo anterior
WHEN el usuario inicia el AutoMix con otra pista o lista mientras había uno en marcha THE SYSTEM SHALL pausar la pista que siguiera sonando en el otro deck, cancelar la mezcla en curso y devolver ambos decks a EQ y filtro neutros.

### REQ-2: Sin herencia
WHEN se inicia un tema nuevo THE SYSTEM SHALL descartar la cola, las candidatas de la radio, las pistas fijadas a mano, el plan y la mezcla pendiente del tema anterior.

### REQ-3: Lo que ya suena sigue
IF la pista elegida ya está sonando en un deck THEN THE SYSTEM SHALL mantenerla sonando sin reiniciarla y pausar solo el otro deck.

## Fuera de alcance

- Detener el AutoMix al cargar una pista a mano (sigue siendo decisión del usuario).
