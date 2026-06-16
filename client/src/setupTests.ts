import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// jsdom does not implement matchMedia; hooks like usePwaInstall rely on it.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// jsdom does not implement getAnimations; designsystemet Skeleton calls it.
document.getAnimations = () => []

// jsdom does not implement the native <dialog> methods; designsystemet Dialog
// calls them from a mount effect (e.g. the split-policy "?" help dialog).
HTMLDialogElement.prototype.show = vi.fn()
HTMLDialogElement.prototype.showModal = vi.fn()
HTMLDialogElement.prototype.close = vi.fn()
