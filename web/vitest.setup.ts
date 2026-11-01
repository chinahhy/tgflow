import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { setLocale } from "@/lib/i18n";

// Preserve upstream English assertions; locale tests explicitly choose their language.
beforeEach(() => setLocale("en", false));
