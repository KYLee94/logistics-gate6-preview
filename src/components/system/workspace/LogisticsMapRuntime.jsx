import React from 'react';
import { invokeDashboardApi } from '../../../utils/supabaseSession';

export const MAP_LAYER_OPTIONS = [
  ['normal', '일반'],
  ['satellite', '위성'],
  ['cadastral', '지적편집도'],
];

export function MapLayerControl({ value, onChange, className = '', 'data-testid': dataTestId }) {
  return (
    <div
      className={`absolute right-3 top-3 z-20 flex overflow-hidden rounded-[8px] border border-[#3A3A3C] bg-[#1F1F1E]/90 shadow-xl backdrop-blur ${className}`}
      data-testid={dataTestId}
    >
      {MAP_LAYER_OPTIONS.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange?.(optionValue)}
          className={`h-8 px-3 text-[11px] font-semibold transition-colors ${value === optionValue ? 'bg-white text-[#1F1F1E]' : 'text-[#A1A1AA] hover:text-white'}`}
          data-map-layer-button={optionValue}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export const MAP_CALLOUT_POSITION = Object.freeze({
  leaflet: Object.freeze({
    innerCentered: false,
    offset: Object.freeze([0, -18]),
    panPaddingTopLeft: Object.freeze([170, 96]),
    panPaddingBottomRight: Object.freeze([170, 56]),
  }),
  naver: Object.freeze({
    innerCentered: true,
    pixelOffset: Object.freeze([0, -30]),
    disableAutoPan: false,
  }),
  static: Object.freeze({
    innerCentered: false,
    edgePadding: 12,
    minTopPercent: 22,
  }),
});

export const MAP_CALLOUT_STYLES = `
  .logistics-map-tooltip {
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .logistics-map-tooltip::before {
    display: none !important;
  }
  .logistics-map-tooltip,
  .logistics-map-tooltip * {
    box-sizing: border-box !important;
  }
  .logistics-map-callout-wrap {
    display: block;
    pointer-events: auto;
  }
  .logistics-map-callout-wrap--centered {
    transform: translateX(-50%);
  }
  .logistics-map-callout {
    display: block;
    min-width: 220px;
    max-width: min(320px, calc(100vw - 48px));
    width: max-content;
    border: 0;
    outline: 0;
    border-radius: 8px;
    background: #fff;
    color: #111;
    padding: 10px 12px;
    text-align: left;
    font-size: 12px;
    line-height: 1.45;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
    cursor: pointer;
    white-space: nowrap;
  }
  .logistics-map-callout,
  .logistics-map-callout * {
    box-sizing: border-box !important;
  }
  .logistics-map-callout strong {
    display: block;
    margin-bottom: 4px;
    color: #111;
    font-weight: 700;
    white-space: nowrap;
  }
  .logistics-map-callout span {
    display: block;
    color: #111;
    white-space: nowrap;
  }
  [data-map-callout-anchor="true"]:hover,
  [data-map-callout-anchor="true"]:focus-within {
    z-index: 40 !important;
  }
  .logistics-map-static-callout {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 10px);
    z-index: 30;
    display: none;
    transform: translateX(calc(-50% + var(--logistics-map-callout-shift-x, 0px)));
  }
  .logistics-map-static-callout .logistics-map-callout {
    min-width: min(220px, var(--logistics-map-callout-max-width, 220px));
    max-width: min(320px, calc(100vw - 48px), var(--logistics-map-callout-max-width, 320px));
  }
  [data-map-callout-anchor="true"]:hover > .logistics-map-static-callout,
  [data-map-callout-anchor="true"]:focus-within > .logistics-map-static-callout {
    display: block;
  }
`;

export function escapeMapHtml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
    .replace(/`/gu, '&#96;');
}

function mapCalloutProvider(provider) {
  return MAP_CALLOUT_POSITION[provider] ? provider : 'naver';
}

function mapCalloutClassName(provider) {
  const normalizedProvider = mapCalloutProvider(provider);
  return [
    'logistics-map-callout-wrap',
    MAP_CALLOUT_POSITION[normalizedProvider].innerCentered ? 'logistics-map-callout-wrap--centered' : '',
    normalizedProvider === 'static' ? 'logistics-map-static-callout' : '',
  ].filter(Boolean).join(' ');
}

export function buildMapCalloutHtml({
  title,
  detail = '',
  assetId = '',
  assetName = '',
  pointCallout = false,
}, { provider = 'naver' } = {}) {
  const normalizedProvider = mapCalloutProvider(provider);
  const assetAttributes = assetId || assetName
    ? ` data-map-asset-id="${escapeMapHtml(assetId)}" data-map-asset-name="${escapeMapHtml(assetName)}"`
    : '';
  const pointAttribute = pointCallout ? ' data-map-point-callout="true"' : '';
  return `<div class="${mapCalloutClassName(normalizedProvider)}" data-map-callout-provider="${normalizedProvider}" data-map-callout-position="top-center"><button type="button"${assetAttributes}${pointAttribute} class="logistics-map-callout"><strong>${escapeMapHtml(title)}</strong><span>${escapeMapHtml(detail)}</span></button></div>`;
}

export function MapCallout({
  title,
  detail = '',
  assetId = '',
  assetName = '',
  pointCallout = false,
  provider = 'static',
  onClick,
}) {
  const normalizedProvider = mapCalloutProvider(provider);
  return (
    <div
      className={mapCalloutClassName(normalizedProvider)}
      data-map-callout-provider={normalizedProvider}
      data-map-callout-position="top-center"
      data-map-static-callout={normalizedProvider === 'static' ? 'true' : undefined}
    >
      <button
        type="button"
        data-map-asset-id={assetId || undefined}
        data-map-asset-name={assetName || undefined}
        data-map-point-callout={pointCallout ? 'true' : undefined}
        className="logistics-map-callout"
        onClick={onClick}
      >
        <strong>{title}</strong>
        <span>{detail}</span>
      </button>
    </div>
  );
}

export function getLeafletMapCalloutOptions(overrides = {}) {
  const contract = MAP_CALLOUT_POSITION.leaflet;
  return {
    direction: 'top',
    offset: [...contract.offset],
    opacity: 1,
    sticky: false,
    interactive: true,
    className: 'logistics-map-tooltip',
    ...overrides,
  };
}

export function createNaverMapCalloutOptions(naver, content, overrides = {}) {
  const contract = MAP_CALLOUT_POSITION.naver;
  return {
    content,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    disableAnchor: true,
    disableAutoPan: contract.disableAutoPan,
    anchorSize: new naver.maps.Size(0, 0),
    pixelOffset: new naver.maps.Point(...contract.pixelOffset),
    ...overrides,
  };
}

export function panLeafletMapForCallout(map, marker) {
  if (!map?.panInside || !marker?.getLatLng) return;
  const contract = MAP_CALLOUT_POSITION.leaflet;
  map.panInside(marker.getLatLng(), {
    paddingTopLeft: [...contract.panPaddingTopLeft],
    paddingBottomRight: [...contract.panPaddingBottomRight],
    animate: false,
  });
}

export function constrainStaticMapCalloutAnchorStyle(style = {}) {
  const left = Number.parseFloat(style.left);
  const top = Number.parseFloat(style.top);
  return {
    ...style,
    left: Number.isFinite(left) ? `${Math.max(2, Math.min(98, left))}%` : style.left,
    top: Number.isFinite(top) ? `${Math.max(MAP_CALLOUT_POSITION.static.minTopPercent, Math.min(98, top))}%` : style.top,
  };
}

export function positionStaticMapCallout(anchor) {
  if (!anchor || typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    const boundary = anchor.closest('[data-map-callout-boundary="true"]');
    const callout = anchor.querySelector('[data-map-static-callout="true"]');
    if (!boundary || !callout) return;
    const boundaryRect = boundary.getBoundingClientRect();
    const edgePadding = MAP_CALLOUT_POSITION.static.edgePadding;
    callout.style.setProperty('--logistics-map-callout-shift-x', '0px');
    callout.style.setProperty('--logistics-map-callout-max-width', `${Math.max(120, boundaryRect.width - (edgePadding * 2))}px`);
    const calloutRect = callout.getBoundingClientRect();
    const minLeft = boundaryRect.left + edgePadding;
    const maxRight = boundaryRect.right - edgePadding;
    const shiftX = calloutRect.left < minLeft
      ? minLeft - calloutRect.left
      : calloutRect.right > maxRight
        ? maxRight - calloutRect.right
        : 0;
    callout.style.setProperty('--logistics-map-callout-shift-x', `${Math.round(shiftX)}px`);
  });
}

export async function getNaverMapsClientId() {
  if (typeof window === 'undefined') return '';
  if (window.__logisticsNaverMapsClientId) return window.__logisticsNaverMapsClientId;
  if (window.__logisticsNaverMapsClientIdPromise) return window.__logisticsNaverMapsClientIdPromise;
  window.__logisticsNaverMapsClientIdPromise = invokeDashboardApi('naver/maps-config', {})
    .then(({ data, error }) => {
      const config = data?.data || data || {};
      const clientId = config.ncp_key_id || config.client_id || config.clientId || '';
      if (error || data?.ok === false || !clientId) throw new Error(error?.message || data?.message || 'Naver Maps client id unavailable');
      window.__logisticsNaverMapsClientId = clientId;
      return clientId;
    })
    .catch((error) => {
      window.__logisticsNaverMapsClientIdPromise = null;
      throw error;
    });
  return window.__logisticsNaverMapsClientIdPromise;
}

export function loadNaverMapsSdk(clientId) {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'));
  if (!clientId) return Promise.reject(new Error('Naver Maps client id missing'));
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver);
  if (window.__logisticsNaverMapPromise) return window.__logisticsNaverMapPromise;
  window.__logisticsNaverMapPromise = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('Naver Maps SDK timeout')), 5000);
    const resolveWhenReady = () => {
      window.clearTimeout(timeoutId);
      if (window.naver?.maps?.Map) resolve(window.naver);
      else reject(new Error('Naver Maps SDK unavailable'));
    };
    const existingScript = document.getElementById('logistics-naver-map-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', resolveWhenReady, { once: true });
      existingScript.addEventListener('error', () => {
        window.clearTimeout(timeoutId);
        reject(new Error('Naver Maps SDK load failed'));
      }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'logistics-naver-map-sdk';
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = resolveWhenReady;
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('Naver Maps SDK load failed'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    window.__logisticsNaverMapPromise = null;
    throw error;
  });
  return window.__logisticsNaverMapPromise;
}

export function loadLeafletSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser unavailable'));
  if (window.L?.map) return Promise.resolve(window.L);
  if (window.__logisticsLeafletPromise) return window.__logisticsLeafletPromise;
  window.__logisticsLeafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('logistics-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'logistics-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existingScript = document.getElementById('logistics-leaflet-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => (window.L?.map ? resolve(window.L) : reject(new Error('Leaflet SDK unavailable'))), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Leaflet SDK load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'logistics-leaflet-sdk';
    script.async = true;
    script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => (window.L?.map ? resolve(window.L) : reject(new Error('Leaflet SDK unavailable')));
    script.onerror = () => reject(new Error('Leaflet SDK load failed'));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__logisticsLeafletPromise = null;
    throw error;
  });
  return window.__logisticsLeafletPromise;
}
