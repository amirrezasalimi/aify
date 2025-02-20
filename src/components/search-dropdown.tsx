import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchDropdownProps {
  options: { id: string; label: string }[];
  selectedOption: string | undefined;
  onSelect: (option: string) => void;
  placeholder?: string;
}

const SearchDropdown = ({
  options,
  selectedOption,
  onSelect,
  placeholder = "Select an option",
}: SearchDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
      <div
        className="flex justify-between items-center bg-gray-900 px-3 py-2 border border-gray-800 rounded-md w-full text-sm cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption || placeholder}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>
      {isOpen && (
        <div className="z-10 absolute bg-gray-900 shadow-lg mt-1 border border-gray-800 rounded-md w-full max-h-60 overflow-auto">
          <div className="top-0 sticky bg-gray-900 p-2">
            <div className="relative">
              <Search className="top-1/2 left-2 absolute w-4 h-4 text-gray-400 -translate-y-1/2 transform" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                className="bg-gray-800 py-1 pr-3 pl-8 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 w-full text-sm placeholder-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="pb-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className="hover:bg-gray-800 px-3 py-2 text-sm cursor-pointer"
                  onClick={() => {
                    onSelect(option.id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-400 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
