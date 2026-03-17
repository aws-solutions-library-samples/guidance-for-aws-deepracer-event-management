import { Box, Button, SpaceBetween } from '@cloudscape-design/components';
import { PropertyFilterProps } from '@cloudscape-design/components';
import i18next from '../i18n';

/**
 * Props for TableNoMatchState component
 */
interface TableNoMatchStateProps {
  label: string;
  description: string;
  buttonLabel: string;
  onClearFilter: () => void;
}

/**
 * Props for TableEmptyState component
 */
interface TableEmptyStateProps {
  resourceName: string;
}

export const TableNoMatchState: React.FC<TableNoMatchStateProps> = ({
  label,
  description,
  buttonLabel,
  onClearFilter,
}) => (
  <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
    <SpaceBetween size="xxs">
      <div>
        <b>{label}</b>
        <Box variant="p" color="inherit">
          {description}
        </Box>
      </div>
      <Button onClick={onClearFilter}>{buttonLabel}</Button>
    </SpaceBetween>
  </Box>
);

export const TableEmptyState: React.FC<TableEmptyStateProps> = ({ resourceName }) => (
  <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
    <SpaceBetween size="xxs">
      <b>No {resourceName.toLowerCase()}</b>
    </SpaceBetween>
  </Box>
);

export const PropertyFilterI18nStrings = (resourceName: string): PropertyFilterProps.I18nStrings => {
  const strings: PropertyFilterProps.I18nStrings = {
    filteringAriaLabel: i18next.t('filtering.filtering-aria-label'),
    dismissAriaLabel: i18next.t('filtering.dismiss-aria-label'),
    clearAriaLabel: i18next.t('filtering.clear-aria-label'),

    filteringPlaceholder: i18next.t('filtering.placeholder', { resource: resourceName }),
    groupValuesText: i18next.t('filtering.group-values-text'),
    groupPropertiesText: i18next.t('filtering.group-properties-text'),
    operatorsText: i18next.t('filtering.operators-text'),

    operationAndText: i18next.t('filtering.operation-and-text'),
    operationOrText: i18next.t('filtering.operation-or-text'),

    operatorLessText: i18next.t('filtering.operator-less-text'),
    operatorLessOrEqualText: i18next.t('filtering.operator-less-or-equal-text'),
    operatorGreaterText: i18next.t('filtering.operator-greater-text'),
    operatorGreaterOrEqualText: i18next.t('filtering.operator-greater-or-equal-text'),
    operatorContainsText: i18next.t('filtering.operator-contains-text'),
    operatorDoesNotContainText: i18next.t('filtering.operator-does-not-contain-text'),
    operatorEqualsText: i18next.t('filtering.operator-equals-text'),
    operatorDoesNotEqualText: i18next.t('filtering.operator-does-not-equal-text'),

    editTokenHeader: i18next.t('filtering.edit-token-header'),
    propertyText: i18next.t('filtering.property-text'),
    operatorText: i18next.t('filtering.operator-text'),
    valueText: i18next.t('filtering.value-text'),
    cancelActionText: i18next.t('filtering.cancel-action-text'),
    applyActionText: i18next.t('filtering.apply-action-text'),
    allPropertiesLabel: i18next.t('filtering.all-properties-label'),

    tokenLimitShowMore: i18next.t('filtering.token-limit-show-more'),
    tokenLimitShowFewer: i18next.t('filtering.token-limit-show-fewer'),
    clearFiltersText: i18next.t('filtering.clear-filters-text'),
    removeTokenButtonAriaLabel: (token) =>
      `Remove token ${token.propertyKey} ${token.operator} ${token.value}`,
    enteredTextLabel: (text) => `Use: "${text}"`,
  };

  return strings;
};
