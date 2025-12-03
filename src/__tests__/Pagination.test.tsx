import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "../components/Pagination";
import type { PaginationItem } from "../paginationTypes";

const baseItems: PaginationItem[] = [
  { type: "prev", page: 1, disabled: true },
  { type: "page", page: 1, isCurrent: true },
  { type: "ellipsis" },
  { type: "page", page: 5 },
  { type: "next", page: 2 },
];

describe("Pagination", () => {
  it("renders nothing when no items are provided", () => {
    const { container } = render(<Pagination items={[]} onPageChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("invokes onPageChange and renders custom ellipsis", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <Pagination
        items={baseItems}
        onPageChange={onPageChange}
        renderEllipsis={() => <span>더보기</span>}
      />
    );

    expect(screen.getByText("더보기")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
