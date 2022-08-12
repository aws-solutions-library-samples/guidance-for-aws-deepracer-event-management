import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { Header, Table, Icon, Button, Input } from 'semantic-ui-react';
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
      placeholder={`Search ${count} records...`}
    />
  )
}

function AdminUsers() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiName = 'deepracerEventManager';

  useEffect(() => {
    const getUsers = async() => {
      const apiUserPath = 'users';

      // TODO: check the status code
      const userRsponse = await API.get(apiName, apiUserPath);
      const users = userRsponse.map(u =>
        ({
          ...u,
          isAdmin: false
        })
      )

      const apiAdminPath = 'admin/groups/admin';

      // TODO: check the status code
      const adminResponse = await API.get(apiName, apiAdminPath);
      adminResponse.forEach(admin => {
        const i = users.findIndex((user => user.Username == admin.Username));
        users[i].isAdmin = true;
      });

      setData(users);
      setIsLoading(false);
    }

    getUsers();

    return() => {
      // Unmounting
    }

  },[refreshKey]);

  const ToggleUserGroup = async(user) => {
    const apiName = 'deepracerEventManager';
    let groupUserResponse = '';

    if (user.isAdmin) {
      const apiGroupUserPath = 'admin/groups/admin/' + user.Username;
      groupUserResponse = await API.del(apiName, apiGroupUserPath)
    } else {
      const apiGroupUserPath = 'admin/groups/admin';
      const params = {
        body: {
          username: user.Username
        },
      };
      groupUserResponse = await API.post(apiName, apiGroupUserPath, params)
    }
    // need to reload the user data
    setRefreshKey(oldKey => oldKey +1)
  }

  const columns = React.useMemo(
    () => [
      {
        Header: 'User',
        accessor: (row) => {
          return row.Username
        }
      },
      {
        Header: 'Admin',
        disableFilters: true,
        accessor: (row) => {
          if (row.isAdmin) {
            return (
              <Button positive circular icon='check circle' id='{row.Username}' onClick={(c) => { ToggleUserGroup(row) }}/>
            )
          } else {
            return (
              <Button negative circular icon='delete' id='{row.Username}' onClick={(c) => { ToggleUserGroup(row) }}/>
            )
          }
        }
      }
    ],
    []
  )

  // Cell: ({ e }) => (<a href="#" className="btn btn-info" onClick={(c) => { debugger; console.log(e.cn); console.log(e); console.log(c) }}> Users </a>)

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
      <Header as='h1' icon textAlign='center'>Users</Header>
      {isLoading ? (
        <div>Loading data...</div>
      ) : (
      <Table celled striped {...getTableProps()}>
        <Table.Header>
          {headerGroups.map(headerGroup => (
            <Table.Row {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map(column => (
                <Table.HeaderCell {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render('Header')}
                  <span>
                    {column.canSort
                      ? column.isSorted
                        ? column.isSortedDesc
                          ? <Icon name='sort down' />
                          : <Icon name='sort up' />
                        : <Icon disabled name='sort' />
                      : ''}
                  </span>
                  <div>{column.canFilter ? column.render('Filter') : null}</div>
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

export {AdminUsers}
