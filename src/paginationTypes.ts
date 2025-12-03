export type PaginationItemType = "page" | "ellipsis" | "prev" | "next";

export interface PaginationItem {
  type: PaginationItemType;
  page?: number;
  isCurrent?: boolean;
  disabled?: boolean;
}
