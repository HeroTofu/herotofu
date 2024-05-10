import { renderHook, act, waitFor } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';
import { useFormData } from '../useFormData';

const MOCK_200_RESPONSE = { status: 200, body: 'OK' };
const MOCK_404_RESPONSE = { status: 404, body: 'Not Found' };
const MOCK_422_RESPONSE = { status: 422, body: 'Unprocessable Entity' };
const MOCK_429_RESPONSE = { status: 429, body: 'Too Many Requests' };
const MOCK_500_RESPONSE = { status: 500, body: 'Internal Error' };

describe('calling the useFormData() hook', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    fetchMock.doMock();
  });

  it('submits the form successfully', async () => {
    fetchMock.mockOnce(async () => MOCK_200_RESPONSE);

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-form-id'));
    const { formEvent, expectedFormData } = setupHtmlForm({ custom: 'data' });

    expect(result.current.state).toStrictEqual({ status: undefined });
    expect(typeof result.current.handleFormSubmit).toBe('function');

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy, { custom: 'data' });
    act(() => void formSubmitHandler(formEvent));

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));
    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'success', data: expectedFormData }));

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'success', data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles a 404 error', async () => {
    fetchMock.mockOnce(async () => MOCK_404_RESPONSE);

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    const expectedError = new Error('Not Found');

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));
    await waitFor(() =>
      expect(result.current.state).toStrictEqual({ status: 'error', error: expectedError, data: expectedFormData })
    );

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'error', error: expectedError, data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles a 422 error', async () => {
    fetchMock.mockOnce(async () => MOCK_422_RESPONSE);

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    const expectedError = new Error('Please complete the captcha challenge');

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));
    await waitFor(() =>
      expect(result.current.state).toStrictEqual({ status: 'error', error: expectedError, data: expectedFormData })
    );

    expect(document.querySelector('form')?.getAttribute('target')).toBe('_blank');
    expect(document.querySelector('form')?.getAttribute('action')).toBe('https://public.herotofu.com/v1/test-id');

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'error', error: expectedError, data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles a 429 error and failed retry', async () => {
    fetchMock.mockOnce(async () => MOCK_429_RESPONSE);
    fetchMock.mockOnce(async () => MOCK_429_RESPONSE);

    act(() => jest.useFakeTimers());

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    const expectedError = new Error('Too Many Requests');

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));

    jest.advanceTimersByTime(11000);

    await waitFor(() =>
      expect(result.current.state).toStrictEqual({ status: 'error', error: expectedError, data: expectedFormData })
    );

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'error', error: expectedError, data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
  });

  it('handles a 429 error and successful retry', async () => {
    fetchMock.mockOnce(async () => MOCK_429_RESPONSE);
    fetchMock.mockOnce(async () => MOCK_200_RESPONSE);

    act(() => jest.useFakeTimers());

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));

    jest.advanceTimersByTime(11000);

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'success', data: expectedFormData }));

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'success', data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
  });

  it('handles a timeout on abort controller', async () => {
    fetchMock.mockAbortOnce();

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    const expectedError = new Error('The operation was aborted. ');

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'error', error: expectedError, data: expectedFormData })
    );

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'error', error: expectedError, data: expectedFormData });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles a 500 error', async () => {
    fetchMock.mockOnce(async () => MOCK_500_RESPONSE);

    const callbackSpy = jest.fn();
    const { result } = renderHook(() => useFormData('test-id'));
    const { formEvent, expectedFormData } = setupHtmlForm();

    const formSubmitHandler = result.current.handleFormSubmit(callbackSpy);
    act(() => void formSubmitHandler(formEvent));

    const expectedError = new Error('Internal Server Error');

    await waitFor(() => expect(result.current.state).toStrictEqual({ status: 'loading', data: expectedFormData }));

    await waitFor(() =>
      expect(result.current.state).toStrictEqual({ status: 'error', error: expectedError, data: expectedFormData })
    );

    expect(callbackSpy).toHaveBeenCalledWith({ status: 'error', error: expectedError, data: expectedFormData });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function setupHtmlForm(additionalData: Record<string, string> = {}) {
  const formElement = document.createElement('form');
  formElement.innerHTML = `
    <input type="text" name="name" value="Joe Bloggs">
    <input type="email" name="email" value="joe.bloggs@example.com">
  `;

  document.querySelectorAll('form').forEach((form) => form.remove());
  document.body.appendChild(formElement);

  const formEvent = {
    preventDefault: jest.fn(),
    currentTarget: formElement,
  } as unknown as React.FormEvent;

  const expectedFormData = new FormData();
  expectedFormData.append('name', 'Joe Bloggs');
  expectedFormData.append('email', 'joe.bloggs@example.com');

  if (Object.keys(additionalData).length) {
    Object.entries(additionalData).forEach(([key, value]) => {
      expectedFormData.append(key, value);
    });
  }

  return { formEvent, expectedFormData };
}