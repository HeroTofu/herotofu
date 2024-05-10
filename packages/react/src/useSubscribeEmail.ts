import { useCallback } from 'react';
import { useJsonData } from './useJsonData';
import type { RequestCallback, FormId, RequestOptions, UseSubscribeEmailReturn } from './types';

/*
  Example usage:

  function MyComponent() {
    const { state: subscribeState, subscribe } = useSubscribeEmail('00000000-1111-2222-3333-444444444444');
    const onSubmit = ({status, data}) => {
      console.log(`The user was subscribed with status: ${status} and data: ${JSON.stringify(data)}`);
    };

    const dummyCallbackOnButtonClick = () => {
      subscribe('joe.bloggs@example.com', onSubmit);
    }

    ...
  }
 */
function useSubscribeEmail(formIdOrUrl: FormId, options: RequestOptions = {}): UseSubscribeEmailReturn {
  const { state, sendData, __dangerousUpdateState } = useJsonData(formIdOrUrl, options);

  const subscribe = useCallback(
    (emailToSubsribe: string, callbackOnComplete?: RequestCallback) => {
      const email = String(emailToSubsribe).trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        __dangerousUpdateState(
          { status: 'error', error: new Error('Invalid email address'), data: { email } },
          callbackOnComplete
        );
        return;
      }

      sendData(callbackOnComplete, { email });
    },
    [formIdOrUrl]
  );

  return { state, subscribe };
}

export { useSubscribeEmail };
