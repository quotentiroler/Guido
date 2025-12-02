import React, { RefObject } from "react";
import Delete from "@/assets/svg/delete.svg";
import DisconnectedIcon from "@/assets/svg/disconnected-icon.svg";
import EnterIcon from "@/assets/svg/search.svg"; // Import the Enter icon
import IconWithTooltip from "./shared/FancyIcon";
import useRegistry from "@/hooks/useRegistry";

interface SearchInputProps {
    searchTerm: string;
    onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearSearch: () => void;
    inputRef: RefObject<HTMLInputElement | null>;
    onFocus: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const SearchInput: React.FC<SearchInputProps> = ({
    searchTerm,
    onSearchChange,
    onClearSearch,
    inputRef,
    onFocus,
    onKeyDown,
}) => {
    const { isConnected, checkConnection } = useRegistry(); // Use the hook directly

    const handleEnterClick = () => {
        // Simulate an "Enter" key press
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        onKeyDown(event as unknown as React.KeyboardEvent<HTMLInputElement>);
    };

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                id="registry-search"
                name="registry-search"
                type="text"
                onFocus={onFocus}
                value={searchTerm}
                onChange={onSearchChange}
                placeholder="Search registries..."
                aria-label="Search registries"
                className="border  p-2 rounded w-full bg-surface-0 text-text-primary"
                onKeyDown={onKeyDown}
            />
            <div className="flex items-center space-x-2 absolute right-2 top-1/2 transform -translate-y-1/2">
                {searchTerm && (
                    <>
                        <button
                            type="button"
                            onClick={handleEnterClick}
                            className="bg-surface-4 rounded-full w-6 h-6 flex items-center justify-center"
                        >
                            <img src={EnterIcon} alt="Enter" className="h-4 w-4 dark:invert" />
                        </button>
                        <button
                            type="button"
                            onClick={onClearSearch}
                            className="bg-surface-4 rounded-full w-6 h-6 flex items-center justify-center"
                        >
                            <img src={Delete} alt="Clear" className="h-4 w-4 dark:invert" />
                        </button>
                    </>
                )}
                {!isConnected && (
                    <IconWithTooltip
                        text="Disconnected, click to try again."
                        icon={<img src={DisconnectedIcon} alt="Disconnected" className="h-4 w-4 dark:invert" />}
                        onClick={() => void checkConnection()}
                        className="bg-red-200 rounded-full w-6 h-6 flex items-center justify-center cursor-pointer"
                    />
                )}
            </div>
        </div>
    );
};

export default SearchInput;