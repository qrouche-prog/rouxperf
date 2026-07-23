import Icon from './icons/Icon'

export default function SelectableCardGrid({ options, selected, onToggle, exclusiveValue }) {
  return (
    <div className="card-grid" role="group">
      {options.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            className={`select-card${isSelected ? ' select-card-active' : ''}`}
            aria-pressed={isSelected}
            onClick={() => onToggle(option.value, exclusiveValue)}
          >
            <Icon name={option.icon} />
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
