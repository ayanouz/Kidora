// ══════════════════════════════════════════════════════════════════
//  KIDORA — Tests : composant Button (design system §47)
//  Accessibilité tactile : jamais cliquable pendant le chargement.
// ══════════════════════════════════════════════════════════════════

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "../components/ui/Button";

describe("<Button />", () => {
  it("rend le texte et déclenche onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Jouer</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("est désactivé et aria-busy pendant le chargement", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoi…
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Envoi/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applique la variante et la taille demandées", () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        Supprimer
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Supprimer" });
    expect(button.className).toContain("btn-danger");
    expect(button.className).toContain("btn-lg");
    expect(button.className).toContain("w-full");
  });

  it("type=button par défaut (pas de soumission de formulaire involontaire)", () => {
    render(<Button>OK</Button>);
    expect(screen.getByRole("button", { name: "OK" })).toHaveAttribute("type", "button");
  });

  it("respecte disabled explicite", () => {
    render(<Button disabled>Bloqué</Button>);
    expect(screen.getByRole("button", { name: "Bloqué" })).toBeDisabled();
  });
});
