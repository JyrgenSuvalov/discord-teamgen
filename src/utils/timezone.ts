import { Temporal } from "@js-temporal/polyfill";

/**
 * Get current date in YYYY-MM-DD format using the specified timezone
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
 * @returns Date string in YYYY-MM-DD format
 */
export function getCurrentDateInTimezone(timezone: string): string {
	const now = Temporal.Now.zonedDateTimeISO(timezone);
	return now.toPlainDate().toString();
}

/**
 * Validate timezone identifier
 * @param timezone - IANA timezone identifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
	try {
		// Use Intl.DateTimeFormat to validate timezone
		new Intl.DateTimeFormat("en", { timeZone: timezone });
		return true;
	} catch {
		return false;
	}
}
