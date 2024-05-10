export type RequestState =
  | { status: undefined }
  | { status: 'loading'; data?: FormData | Record<string, unknown> }
  | { status: 'success'; data?: FormData | Record<string, unknown> }
  | { status: 'error'; error: Error; data?: FormData | Record<string, unknown> };

export type RequestCallback = (status: RequestState, data?: Record<string, unknown>) => void;
export type InjectedData = Record<string, unknown>;
export type FormId = string;
export type RequestOptions = Partial<Parameters<typeof fetch>[1]> & { timeout?: number };

export type FormSubmitHandler = (
  callbackOnComplete?: RequestCallback,
  injectedData?: InjectedData
) => React.FormEventHandler;

export type UseFormDataReturn = {
  state: RequestState;
  handleFormSubmit: FormSubmitHandler;
  __dangerousUpdateState: (newState: RequestState, callbackOnComplete?: RequestCallback) => void;
};

export type DataSubmitHandler = (callbackOnComplete?: RequestCallback, injectedData?: InjectedData) => void;

export type UseJsonDataReturn = {
  state: RequestState;
  sendData: DataSubmitHandler;
  __dangerousUpdateState: (newState: RequestState, callbackOnComplete?: RequestCallback) => void;
};

export type UseSubscribeEmailReturn = {
  state: RequestState;
  subscribe: (email: string, callbackOnComplete?: RequestCallback) => void;
};
