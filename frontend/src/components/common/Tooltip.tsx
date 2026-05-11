/**
 * Tooltip component
 * Accessible tooltip that shows on hover and focus
 */

import React, { useState, useId } from 'react';

type TooltipTriggerProps = Pick<
  React.HTMLAttributes<HTMLElement>,
  'onMouseEnter' | 'onMouseLeave' | 'onFocus' | 'onBlur'
> & {
  'aria-describedby'?: string;
};

export interface TooltipProps {
  content: string;
  children: React.ReactElement<TooltipTriggerProps>;
  position?: 'above' | 'below' | 'left' | 'right';
}

const TooltipComponent = ({
  content,
  children,
  position = 'above',
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const handleMouseEnter = () => setIsVisible(true);
  const handleMouseLeave = () => setIsVisible(false);
  const handleFocus = () => setIsVisible(true);
  const handleBlur = () => setIsVisible(false);

  const child = React.Children.only(children);
  const childWithProps = React.cloneElement(child, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-describedby': isVisible ? tooltipId : undefined,
  });

  return (
    <span className="tooltip-wrapper">
      {childWithProps}
      {isVisible && (
        <span className={`tooltip-${position}`} role="tooltip" id={tooltipId}>
          {content}
        </span>
      )}
    </span>
  );
};

// Memoize to prevent unnecessary re-renders
export const Tooltip = React.memo(TooltipComponent);
