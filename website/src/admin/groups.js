import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { API } from 'aws-amplify';
import { Header, Table, Icon, Button, Input, Breadcrumb } from 'semantic-ui-react';
import { useTable, useSortBy, useRowSelect, useFilters } from 'react-table'

function DefaultColumnFilter({
  column: { filterValue, preFilteredRows, setFilter },
}) {
  const count = preFilteredRows.length

  return (
    <Input
      icon={{ name: 'search', circular: true }}
      value={filterValue || ''}
      onChange={e => {
        setFilter(e.target.value || undefined) // Set undefined to remove the filter entirely
      }}
      placeholder={`Search ${count} groups...`}
    />
  )
}

function AdminGroups() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const apiName = 'deepracerEventManager';

  useEffect(() => {
    const getData = async() => {
      const apiPath = 'admin/groups';

      // TODO: check the status code
      const groups = await API.get(apiName, apiPath);
      setData(groups.Groups);

      setIsLoading(false);
    }

    getData();

    return() => {
      // Unmounting
    }

  },[]);

  const columns = React.useMemo(
    () => [
      {
        Header: 'Name',
        accessor: (row) => {
          return (
            <>
            <Link to={{ pathname: `/admin/groups/${row.GroupName }` }} >{row.GroupName}</Link>
            </>
          )
        }
      },
      {
        Header: 'Description',
        disableFilters: true,
        disableSortBy: true,
        accessor: (row) => {
          return row.Description
        }
      // },
      // {
      //   Header: 'Actions',
      //   disableFilters: true,
      //   disableSortBy: true,
      //   accessor: (row) => {
      //     if (row.GroupName === "admin") {
      //       return "Default admin group"
      //     } else {
      //       return (
      //         <>
      //         <Button circular color='blue' size='large' icon='edit' id='{row.GroupName}' />
      //         <Button circular color='red' size='large' icon='delete' id='{row.GroupName}' />
      //         </>
      //       )
      //     }
      //   }
      }
    ],
    []
  )

  const defaultColumn = React.useMemo(
    () => ({
      Filter: DefaultColumnFilter,
    }),
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
      defaultColumn,
    },
    useFilters,
    useSortBy,
    useRowSelect
  )

  return (
    <>
      <Breadcrumb>
        <Breadcrumb.Section>Admin</Breadcrumb.Section>
        <Breadcrumb.Divider />
        <Breadcrumb.Section active><Link to='/admin/groups/'>Groups</Link></Breadcrumb.Section>
      </Breadcrumb>
      <Header as='h1' icon textAlign='center'>Groups</Header>
      {isLoading ? (
        <div>Loading data...</div>
      ) : (
        <Table celled striped {...getTableProps()}>
          <Table.Header>
            {headerGroups.map(headerGroup => (
              <Table.Row {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  <Table.HeaderCell {...column.getHeaderProps(column.getSortByToggleProps())}>
                    <div>
                      {column.render('Header')}
                      {column.canSort
                        ? column.isSorted
                          ? column.isSortedDesc
                            ? <Icon name='sort down' />
                            : <Icon name='sort up' />
                          : <Icon disabled name='sort' />
                        : ''}
                      {column.canFilter ? column.render('Filter') : null}
                    </div>
                  </Table.HeaderCell>
                ))}
              </Table.Row>
            ))}
          </Table.Header>
          <Table.Body {...getTableBodyProps()}>
            {rows.map((row, i) => {
              prepareRow(row)
              return (
                <Table.Row {...row.getRowProps()}>
                  {row.cells.map(cell => {
                    return <Table.Cell {...cell.getCellProps()}>{cell.render('Cell')}</Table.Cell>
                  })}
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </>
  )
}

export {AdminGroups}
