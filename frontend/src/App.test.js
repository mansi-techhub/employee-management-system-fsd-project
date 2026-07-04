import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders employee management system heading", () => {
  render(<App />);
  expect(screen.getByText(/employee management system/i)).toBeInTheDocument();
});
