# TypeScript Migration Checklist

Use this checklist when removing `@ts-nocheck` from files and adding proper TypeScript types.

---

## Pre-Migration Checklist

- [ ] Read the file-specific guidance in `TYPESCRIPT_MIGRATION_STATUS.md`
- [ ] Review `TYPESCRIPT_QUICK_REFERENCE.md` for common patterns
- [ ] Ensure all tests are passing before starting
- [ ] Create a git branch for the migration: `git checkout -b typescript/migrate-<component-name>`

---

## Phase 1: Analysis (30 minutes)

- [ ] **Identify all props used in the component**
  - List all props passed to the component
  - Note required vs optional props
  - Document default values
  
- [ ] **List all state variables**
  - Note the type of data each state holds
  - Identify initial values
  - Document update patterns
  
- [ ] **Document all API/GraphQL operations**
  - List queries used
  - List mutations used
  - List subscriptions used
  - Note the response data structure
  
- [ ] **Note all event handlers**
  - Click handlers
  - Change handlers  
  - Custom callbacks
  - Async operations
  
- [ ] **Identify helper functions**
  - Note function parameters
  - Note return types
  - Document side effects

---

## Phase 2: Create Type Definitions (1-2 hours)

### Step 1: Define Props Interface

- [ ] Create interface for component props
  ```typescript
  interface ComponentNameProps {
    // Add all props with types
    requiredProp: Type;
    optionalProp?: Type;
  }
  ```

### Step 2: Create State Type Definitions

- [ ] Define types for complex state objects
  ```typescript
  interface StateType {
    field1: Type1;
    field2: Type2;
  }
  ```

### Step 3: Define API Response Types

- [ ] Create interfaces for GraphQL responses
  ```typescript
  interface QueryResponse {
    queryName: {
      field: Type;
    };
  }
  ```

### Step 4: Type Event Handlers

- [ ] Add types to event handler functions
  ```typescript
  const handleEvent = (param: Type): ReturnType => {
    // Implementation
  };
  ```

### Step 5: Add Function Return Types

- [ ] Add explicit return types to helper functions
  ```typescript
  function helperFunction(param: Type): ReturnType {
    // Implementation
  }
  ```

---

## Phase 3: Apply Types (1-2 hours)

### Step 1: Remove @ts-nocheck

- [ ] Delete the `// @ts-nocheck` comment from the top of the file
- [ ] Run `npx tsc --noEmit` to see all type errors

### Step 2: Add Props Interface

- [ ] Update component signature with props interface
  ```typescript
  // Option 1
  export const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
    // ...
  };
  
  // Option 2 (preferred for complex components)
  export function Component({ prop1, prop2 }: ComponentProps) {
    // ...
  }
  ```

### Step 3: Type useState Calls

- [ ] Add generic type parameters to all `useState` calls
  ```typescript
  const [state, setState] = useState<StateType>(initialValue);
  ```

### Step 4: Type useEffect Dependencies

- [ ] Ensure useEffect dependency arrays are correct
- [ ] Add types to useEffect cleanup functions

### Step 5: Type GraphQL Operations

- [ ] Add type assertions to `API.graphql` calls
  ```typescript
  const response = await API.graphql(
    graphqlOperation(query, variables)
  ) as GraphQLResult<ResponseType>;
  ```

### Step 6: Type Subscriptions

- [ ] Define subscription event types
  ```typescript
  interface SubscriptionEvent<T> {
    value: { data: T };
  }
  ```
- [ ] Type subscription handlers

### Step 7: Fix Type Errors

- [ ] Address each TypeScript error one by one
- [ ] Use type guards for null checks
- [ ] Add optional chaining where appropriate
- [ ] Use proper union types for variables with multiple types

---

## Phase 4: Verification (30 minutes)

### Step 1: TypeScript Compilation

- [ ] Run `npx tsc --noEmit`
- [ ] Verify **0 errors**
- [ ] Address any remaining errors

### Step 2: ESLint Check

- [ ] Run `npx eslint --ext .ts,.tsx src/`
- [ ] Fix any new errors (warnings are acceptable)
- [ ] Verify no new ESLint errors introduced

### Step 3: Run Tests

- [ ] Run `npm test`
- [ ] Verify all tests still pass
- [ ] Fix any broken tests
- [ ] Add new tests if needed

### Step 4: Build Check

- [ ] Run `npm run build`
- [ ] Verify build succeeds
- [ ] Check bundle size hasn't increased significantly

### Step 5: Manual Testing

- [ ] Test the component in the browser
- [ ] Verify all functionality works
- [ ] Test edge cases
- [ ] Test error scenarios

---

## Code Quality Checklist

### Type Safety

- [ ] No `any` types (unless absolutely necessary and documented)
- [ ] All function parameters have types
- [ ] All function return types are explicit
- [ ] All props have proper interfaces
- [ ] All state variables are typed

### Code Clarity

- [ ] Complex types have JSDoc comments
- [ ] Interfaces have descriptive names
- [ ] Union types are used instead of `any` where appropriate
- [ ] Type assertions are used sparingly and only when safe

### Best Practices

- [ ] Optional properties use `?:` syntax
- [ ] Readonly properties use `readonly` keyword where appropriate
- [ ] Union types use literal types for better type checking
- [ ] Generic types are used for reusable functions

---

## Common Issues Checklist

### Issue: "Implicit any" errors

- [ ] Add explicit type to all function parameters
- [ ] Add generic type to useState calls
- [ ] Add type assertions to API calls

### Issue: "Property does not exist" errors

- [ ] Use optional chaining (`?.`)
- [ ] Add type guards (`if (obj)`)
- [ ] Update interface to include missing properties

### Issue: "Type X is not assignable to type Y"

- [ ] Check type definitions match actual data
- [ ] Use union types if multiple types are valid
- [ ] Add type assertions only if you're certain of the type

### Issue: GraphQL subscription types complex

- [ ] Create SubscriptionEvent<T> helper type
- [ ] Extract subscription data structure to interface
- [ ] Use type assertions for event.value.data

---

## File-Specific Patterns

### For Table Configuration Files

- [ ] Import `TableProps` from Cloudscape
- [ ] Type column definitions: `TableProps.ColumnDefinition<DataType>[]`
- [ ] Type cell renderer functions
- [ ] Type sort/filter functions

### For Files with GraphQL Subscriptions

- [ ] Create SubscriptionEvent helper type
- [ ] Type subscription filter objects
- [ ] Type subscription handler functions
- [ ] Ensure cleanup functions unsubscribe

### For Custom Hooks

- [ ] Define return type interface
- [ ] Type all internal state
- [ ] Type all parameters
- [ ] Document hook behavior with JSDoc

### For Modal/Wizard Components

- [ ] Type step configuration objects
- [ ] Type form state interfaces
- [ ] Type validation functions
- [ ] Type onSubmit/onClose callbacks

---

## Documentation Checklist

- [ ] Update component JSDoc if present
- [ ] Add comments for complex type logic
- [ ] Document any `any` types with explanation
- [ ] Update TYPESCRIPT_MIGRATION_STATUS.md progress

---

## Git Workflow

### Before Committing

- [ ] All checklist items above completed
- [ ] TypeScript compilation passes
- [ ] All tests pass
- [ ] ESLint check passes
- [ ] Build succeeds
- [ ] Manual testing completed

### Commit Message Format

```
typescript: Migrate <ComponentName> to TypeScript

- Remove @ts-nocheck directive
- Add ComponentNameProps interface
- Type all useState hooks
- Type GraphQL operations
- Add types to event handlers
- All tests passing
- 0 TypeScript errors

Closes #<issue-number>
```

### After Committing

- [ ] Create pull request
- [ ] Add description with before/after type coverage
- [ ] Request review
- [ ] Update TYPESCRIPT_MIGRATION_STATUS.md in PR

---

## Success Criteria

Your migration is complete when:

- ✅ `@ts-nocheck` directive removed
- ✅ All props have explicit interface
- ✅ All `useState` calls have type parameters  
- ✅ All function parameters have types
- ✅ All function return types are explicit
- ✅ All event handlers are typed
- ✅ No implicit `any` types
- ✅ `npx tsc --noEmit` returns 0 errors
- ✅ All tests pass (100% pass rate)
- ✅ Production build succeeds
- ✅ Manual testing confirms functionality
- ✅ No new ESLint errors

---

## Estimated Time per File

- **Simple components** (< 300 lines): 2-4 hours
- **Medium components** (300-500 lines): 4-6 hours
- **Complex components** (> 500 lines): 6-10 hours

**Total remaining work:** 48-58 hours for all 12 files (excluding test file)

---

## Next Files to Migrate (Recommended Order)

1. ✅ **deviceTableConfig.tsx** (416 lines, 3-4 hours) - Table config, clear structure
2. ✅ **topNav.tsx** (421 lines, 3-4 hours) - Navigation, straightforward
3. ✅ **commentator-stats.tsx** (254 lines, 3-4 hours) - Smallest subscription file
4. ⬜ **uploadModelsToCar.tsx** (263 lines, 3-4 hours) - File upload
5. ⬜ **useCarsApi.ts** (467 lines, 4-5 hours) - Custom hook

---

## Resources

- **Full Migration Guide:** `TYPESCRIPT_MIGRATION_STATUS.md`
- **Quick Reference:** `TYPESCRIPT_QUICK_REFERENCE.md`
- **Type Definitions:** `src/types/`
- **Validation Summary:** `~/.aws/atx/custom/20260129_145825_610d2fd6/artifacts/validation_summary.md`

---

## Questions or Issues?

If you encounter issues:
1. Check `TYPESCRIPT_QUICK_REFERENCE.md` for common patterns
2. Review similar files that have already been migrated
3. Check `src/types/` for existing type definitions
4. Review TypeScript Handbook for advanced patterns
5. Ask for help with specific type errors

---

**Last Updated:** 2024-01-29  
**Migration Status:** 89% Complete (142/155 files)
