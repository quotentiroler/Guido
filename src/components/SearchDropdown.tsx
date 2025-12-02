import React from "react";
import { SearchResultItem } from "@/hooks/useRegistry";

interface DropdownItemsProps {
    selectedPackage?: SearchResultItem;
    packageVersions: string[];
    packages: SearchResultItem[];
    onSelectPackage: (pkg: SearchResultItem) => void | Promise<void>;
    onSelectVersion: (versionOrBranch: string) => void | Promise<void>;
}

/**
 * Get display label for registry source
 */
const getSourceLabel = (source: string): string => {
    switch (source) {
        case 'github': return 'GitHub';
        case 'npm': return 'NPM';
        case 'simplifier': return 'Simplifier';
        case 'local': return '📦 Local';
        case 'custom': return 'Custom';
        default: return source;
    }
};

/**
 * Get color classes for registry source badge
 */
const getSourceColor = (source: string): string => {
    switch (source) {
        case 'github': return 'bg-surface-5 text-text-primary';
        case 'npm': return 'bg-red-600 text-white';
        case 'simplifier': return 'bg-blue-600 text-white';
        case 'local': return 'bg-green-600 text-white';
        case 'custom': return 'bg-purple-600 text-white';
        default: return 'bg-surface-4 text-text-primary';
    }
};

const DropdownItems: React.FC<DropdownItemsProps> = ({
    selectedPackage,
    packageVersions,
    packages,
    onSelectPackage,
    onSelectVersion,
}) => {
    return (
        <ul className="max-h-64 overflow-y-auto border rounded shadow-md bg-surface-0 ">
            {selectedPackage ? (
                <>
                    <li className="border-b  p-2 font-bold text-text-primary flex justify-between items-center">
                        <span>{selectedPackage.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getSourceColor(selectedPackage.source)}`}>
                            {getSourceLabel(selectedPackage.source)}
                        </span>
                    </li>
                    {packageVersions.length > 0 ? (
                        packageVersions
                            .sort((a, b) =>
                                b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
                            )
                            .map((version) => (
                                <li
                                    key={`${selectedPackage.name}-${version}`}
                                    className="border-b  p-2 hover:bg-surface-hover cursor-pointer text-text-primary"
                                    onClick={() => void onSelectVersion(version)}
                                >
                                    {version}
                                </li>
                            ))
                    ) : (
                        <li className="p-2 text-center text-text-disabled">
                            No versions available
                        </li>
                    )}
                </>
            ) : packages.length > 0 ? (
                <>
                    {packages.map((pkg, index) => (
                        <li
                            key={`${pkg.name}-${pkg.source}-${index}`}
                            className="border-b  p-2 hover:bg-surface-hover cursor-pointer flex justify-between items-center"
                            onClick={() => void onSelectPackage(pkg)}
                        >
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-text-primary truncate">
                                    {pkg.name}
                                    {pkg.version && ` (${pkg.version})`}
                                </h3>
                                {pkg.description && (
                                    <p className="text-gray-700  text-sm truncate">
                                        {pkg.description}
                                    </p>
                                )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ml-2 flex-shrink-0 ${getSourceColor(pkg.source)}`}>
                                {getSourceLabel(pkg.source)}
                            </span>
                        </li>
                    ))}
                </>
            ) : (
                <li className="p-2 text-center text-text-disabled">No results found</li>
            )}
        </ul>
    );
};

export default DropdownItems;