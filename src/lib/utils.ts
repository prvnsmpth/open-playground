import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
	let timeout: NodeJS.Timeout;
	return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
		const context = this;
		const later = function () {
			timeout = null!;
			func.apply(context, args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	} as T;
}