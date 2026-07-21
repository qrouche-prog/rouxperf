import HelpBubble from './HelpBubble'
import MeasurementSilhouette from './MeasurementSilhouette'
import { MEASUREMENT_GUIDES, MEASUREMENT_TIP } from './measurementGuides'

export default function MeasurementFieldHelp({ type }) {
  const guide = MEASUREMENT_GUIDES[type]

  return (
    <HelpBubble label={guide.label}>
      <div className="measurement-help-content">
        <MeasurementSilhouette highlight={type} />
        <div>
          <ul>
            {guide.instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="help-tip">{MEASUREMENT_TIP}</p>
        </div>
      </div>
    </HelpBubble>
  )
}
