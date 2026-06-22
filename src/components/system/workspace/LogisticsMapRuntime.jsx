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
