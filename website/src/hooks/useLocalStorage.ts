// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { useCallback, useState } from 'react';

const save = <T>(key: string, value: T): void => localStorage.setItem(key, JSON.stringify(value));

const load = <T>(key: string): T | undefined => {
    const value = localStorage.getItem(key);
    try {
        return value ? (JSON.parse(value) as T) : undefined;
    } catch (e) {
        console.warn(
            `⚠️ The ${key} value that is stored in localStorage is incorrect. Try to remove the value ${key} from localStorage and reload the page`
        );
        return undefined;
    }
};

/**
 * Custom hook for managing state synchronized with localStorage
 * @param key - The localStorage key
 * @param defaultValue - Default value if key doesn't exist in localStorage
 * @returns Tuple containing [value, setValue] similar to useState
 */
export const useLocalStorage = <T>(key: string, defaultValue: T): [T, (newValue: T) => void] => {
    const [value, setValue] = useState<T>(() => load<T>(key) ?? defaultValue);

    const handleValueChange = useCallback(
        (newValue: T): void => {
            setValue(newValue);
            save(key, newValue);
        },
        [key]
    );

    return [value, handleValueChange];
};
