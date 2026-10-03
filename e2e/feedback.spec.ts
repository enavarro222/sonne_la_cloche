import { expect, test } from "./fixtures";

test("the home screen opens the feedback form in a new tab", async ({ page, context }) => {
  await page.goto("/fr/");
  await page.getByRole("button", { name: "Essayer sans vélo" }).click();
  await context.route("**/api/feedback/status", (route) =>
    route.fulfill({ json: { configured: true } }),
  );
  let sent: unknown = null;
  await context.route("**/api/feedback", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { sent: true } });
  });

  // A new tab: the game, and its Bluetooth connection, stay where they are.
  const [form] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Un avis ?" }).click(),
  ]);
  await expect(form.getByRole("heading", { name: "Un avis ?" })).toBeVisible();
  await form.getByRole("button", { name: "Génial" }).click();
  await form.getByRole("textbox", { name: "Ton message" }).fill("Les enfants ont adoré !");
  await form.getByRole("button", { name: "Envoyer" }).click();
  await expect(form.getByText("Merci ! Ton message est bien arrivé.")).toBeVisible();
  // Back to the game: this tab closes, the game's is still there.
  await Promise.all([
    form.waitForEvent("close"),
    form.getByRole("button", { name: "Retour au jeu" }).click(),
  ]);
  expect(sent).toEqual({
    message: "Les enfants ont adoré !",
    rating: "great",
    trainer: "",
    email: "",
    locale: "fr",
    source: "home",
    bike: "demo",
    website: "",
  });
  await expect(page.getByText("Mode démo, sans vélo")).toBeVisible();
});

test("without the server, the feedback page points to GitHub", async ({ page }) => {
  await page.goto("/feedback/?lang=en");
  await expect(page.getByRole("heading", { name: "Your opinion?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open an issue on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/enavarro222/sonne_la_cloche/issues",
  );
});
