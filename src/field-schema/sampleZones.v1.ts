import { FIELD_SCHEMA_VERSION } from './constants';
import type { FieldZoneCatalog } from './catalogTypes';

/**
 * Catálogo mínimo v1 — substituível por artefato CDN `field-zones@olefoot-field-v1.json`.
 * Coordenadas normalizadas; mesmo sistema que formation/tactics em metros derivam de field.ts.
 */
export const ZONE_CATALOG_V1: FieldZoneCatalog = {
  fieldSchemaVersion: FIELD_SCHEMA_VERSION,
  zones: [
    {
      id: 'def_third_home',
      label: 'Terço defensivo (casa)',
      tags: ['third', 'defensive'],
      polygon: [
        { nx: 0, nz: 0 },
        { nx: 0.33, nz: 0 },
        { nx: 0.33, nz: 1 },
        { nx: 0, nz: 1 },
      ],
    },
    {
      id: 'mid_third',
      label: 'Terço central',
      tags: ['third', 'middle'],
      polygon: [
        { nx: 0.33, nz: 0 },
        { nx: 0.66, nz: 0 },
        { nx: 0.66, nz: 1 },
        { nx: 0.33, nz: 1 },
      ],
    },
    {
      id: 'att_third_home',
      label: 'Terço ofensivo (casa)',
      tags: ['third', 'attacking'],
      polygon: [
        { nx: 0.66, nz: 0 },
        { nx: 1, nz: 0 },
        { nx: 1, nz: 1 },
        { nx: 0.66, nz: 1 },
      ],
    },
    {
      id: 'left_corridor',
      label: 'Corredor esquerdo',
      tags: ['corridor', 'wide'],
      polygon: [
        { nx: 0, nz: 0 },
        { nx: 1, nz: 0 },
        { nx: 1, nz: 0.35 },
        { nx: 0, nz: 0.35 },
      ],
    },
    {
      id: 'right_corridor',
      label: 'Corredor direito',
      tags: ['corridor', 'wide'],
      polygon: [
        { nx: 0, nz: 0.65 },
        { nx: 1, nz: 0.65 },
        { nx: 1, nz: 1 },
        { nx: 0, nz: 1 },
      ],
    },
    {
      id: 'central_channel',
      label: 'Canal central',
      tags: ['halfspace'],
      polygon: [
        { nx: 0.2, nz: 0.35 },
        { nx: 0.85, nz: 0.35 },
        { nx: 0.85, nz: 0.65 },
        { nx: 0.2, nz: 0.65 },
      ],
    },
  ],
};
