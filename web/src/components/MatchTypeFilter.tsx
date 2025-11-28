interface MatchTypeFilterProps {
  selectedType: 'all' | 'singles' | 'doubles';
  onTypeChange: (type: 'all' | 'singles' | 'doubles') => void;
}

export default function MatchTypeFilter({ selectedType, onTypeChange }: MatchTypeFilterProps) {
  const options: { value: 'all' | 'singles' | 'doubles'; label: string }[] = [
    { value: 'all', label: 'Vše' },
    { value: 'singles', label: 'Dvouhra' },
    { value: 'doubles', label: 'Čtyřhra' },
  ];

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">Typ zápasu:</h3>
      <div className="inline-flex rounded-md shadow-sm" role="group">
        {options.map((option, index) => (
          <button
            key={option.value}
            onClick={() => onTypeChange(option.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              index === 0 ? 'rounded-l-md' : ''
            } ${
              index === options.length - 1 ? 'rounded-r-md' : ''
            } ${
              selectedType === option.value
                ? 'bg-blue-600 text-white z-10'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            } ${
              index > 0 && selectedType !== option.value && selectedType !== options[index - 1].value
                ? '-ml-px'
                : ''
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
