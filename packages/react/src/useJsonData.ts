import { useState, useCallback } from 'react';
import {
  HEROTOFU_STATUS_RATELIMIT,
  HEROTOFU_STATUS_SPAMBOT,
  HEROTOFU_STATUS_SUCCESS,
  fetchWithTimeout,
  filterInjectedData,
  getFormEndpoint,
} from './utils';
import type { RequestCallback, RequestState, InjectedData, FormId, RequestOptions, UseJsonDataReturn } from './types';

function useJsonData(formIdOrUrl: FormId, options: RequestOptions = {}): UseJsonDataReturn {
  const [state, setState] = useState<RequestState>({ status: undefined });

  const updateState = useCallback((newState: RequestState, callbackOnComplete?: RequestCallback) => {
    setState(newState);

    if (newState.status === 'success' || newState.status === 'error') {
      callbackOnComplete?.(newState);
    }
  }, []);

  const sendData = useCallback(
    async (callbackOnComplete?: RequestCallback, injectedData?: InjectedData) => {
      const data = filterInjectedData(injectedData);
      updateState({ status: 'loading', data });

      try {
        let response = await fetchWithTimeout(getFormEndpoint(formIdOrUrl), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          ...options,
        });

        // Rate limit response, retry one more time after 10 seconds. Then return an error if it repeats
        if (response.status === HEROTOFU_STATUS_RATELIMIT) {
          await new Promise((resolve) => setTimeout(resolve, 10000));
          const retryResponse = await fetchWithTimeout(getFormEndpoint(formIdOrUrl), {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            ...options,
          });

          if (retryResponse.status === HEROTOFU_STATUS_RATELIMIT) {
            throw new Error('Too Many Requests');
          }

          response = retryResponse;
        }

        // It's likely a spam/bot submission, so bypass it to validate via captcha challenge old-school style
        if (response.status === HEROTOFU_STATUS_SPAMBOT) {
          submitHtmlForm(formIdOrUrl, injectedData);
          throw new Error('Please complete the captcha challenge');
        }

        if (response.status !== HEROTOFU_STATUS_SUCCESS) {
          throw new Error(response.statusText);
        }

        updateState({ status: 'success', data }, callbackOnComplete);
      } catch (err: any) {
        updateState({ status: 'error', error: err, data }, callbackOnComplete);
      }
    },
    [formIdOrUrl]
  );

  return { state, sendData, __dangerousUpdateState: updateState };
}

function submitHtmlForm(formIdOrUrl: FormId, injectedData?: InjectedData) {
  const form = document.createElement('form');

  // Append dynamically passed values to the form
  Object.entries(filterInjectedData(injectedData)).forEach(([key, value]) => {
    // Create hidden elements for each key and append them to the form
    const el = document.createElement('input');
    el.type = 'hidden';
    el.name = key;
    el.value = String(value);

    form.appendChild(el);
  });

  // Let's submit the form again and spammer/bot will be redirected to another page automatically
  // Submitting via javascript will bypass calling this function again
  form.setAttribute('action', getFormEndpoint(formIdOrUrl));
  form.setAttribute('target', '_blank');
  form.submit();

  document.body.appendChild(form);
}

export { useJsonData };
