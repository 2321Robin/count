import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MigrationWizard } from "./MigrationWizard";

describe("MigrationWizard", () => {
  afterEach(() => {
    cleanup();
  });

  it("asks to upload local data when the cloud is empty", () => {
    const onChoice = vi.fn();
    render(<MigrationWizard state={{ kind: "upload-local" }} seasonLabel="S2" busy={false} onChoice={onChoice} />);
    expect(screen.getByText(/把本机数据上传到账号/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上传本机数据" }));
    expect(onChoice).toHaveBeenCalledWith("upload-local");
  });

  it("asks which side to keep when both sides have data", () => {
    const onChoice = vi.fn();
    render(<MigrationWizard state={{ kind: "choose", cloudUpdatedAt: "2026-08-11T02:00:00.000Z", localModifiedAt: "2026-08-10T14:32:00.000Z" }} seasonLabel="S3" busy={false} onChoice={onChoice} />);
    expect(screen.getByText(/本机和云端都有数据/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "用云端数据" }));
    expect(onChoice).toHaveBeenCalledWith("use-cloud");
  });
});
