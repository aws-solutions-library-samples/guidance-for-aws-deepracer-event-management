import { BreadcrumbGroup, BreadcrumbGroupProps, Header } from '@cloudscape-design/components';
import React from 'react';

/**
 * Props interface for the ContentHeader component
 */
interface ContentHeaderProps {
  /** Header text to display */
  header: React.ReactNode;
  /** Optional description text below the header */
  description?: React.ReactNode;
  /** Breadcrumb items for navigation */
  breadcrumbs: BreadcrumbGroupProps.Item[];
}

/**
 * ContentHeader component that displays a page header with breadcrumb navigation
 * @param props - Component props
 * @returns Rendered content header with breadcrumbs
 */
export function ContentHeader({ header, description, breadcrumbs }: ContentHeaderProps): JSX.Element {
  return (
    <>
      <BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" />

      <Header variant="h1" description={description}>
        {header}
      </Header>
    </>
  );
}
