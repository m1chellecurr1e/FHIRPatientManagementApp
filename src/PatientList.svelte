<script lang="ts">
  import type {Patient} from 'fhir/r4'
  import { fhirApi } from './api';
  import { onMount } from 'svelte';

  let page = 0
  let searchTerm: string = ''
  let timeout: number;
  let showDeleteDialog = false;
  let patientToDelete: string | undefined = undefined;
  let isSearching = false;
  let searchInput: HTMLInputElement;

  const formatName = (resource: Patient) => {
    const name = resource?.name?.[0]
    if (!name) return 'Unknown'
    if (name.given && name.family) {
      return `${name.given[0]} ${name.family}`
    }
    return name.given?.[0] || name.family || 'Unknown'
  }

  const formatPhoneForSearch = (phone: string): string => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as +1 (XXX) XXX-XXXX if we have enough digits
    if (cleaned.length >= 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
    return phone;
  }

  const isPhoneNumber = (str: string): boolean => {
    // Remove all non-digit characters
    const cleaned = str.replace(/\D/g, '');
    // Check if it has at least 10 digits
    return cleaned.length >= 10;
  }

  const debounce = (input: HTMLInputElement) => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      try {
        isSearching = !!input.value;
        patients = fetchPatients(0, input.value);
      } catch (error) {
        console.error("Error fetching patients:", error);
      }
    }, 300);
  };

  const returnToFullList = () => {
    if (searchInput) {
      searchInput.value = '';
    }
    searchTerm = '';
    isSearching = false;
    patients = fetchPatients(0, '');
  };

  const fetchPatients = async (page: number, searchTerm: string) => {
    try {
      let searchParams = {}
      if (searchTerm) {
        if (isPhoneNumber(searchTerm)) {
          const formattedPhone = formatPhoneForSearch(searchTerm);
          searchParams = { 
            telecom: formattedPhone
          }
          console.log('Searching with phone:', formattedPhone); // Debug log
        } else {
          searchParams = { name: searchTerm }
        }
      }
      
      const patientResponse = await fhirApi.get('/Patient', {
        params: {
          _sort: 'given',
          _count: 20,
          _offset: page*20,
          ...searchParams
        }
      })
      return patientResponse.data
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  }

  const confirmDelete = (id: string | undefined) => {
    patientToDelete = id;
    showDeleteDialog = true;
  };

  const handleDelete = async () => {
    if (!patientToDelete) return;
    try {
      await fhirApi.delete(`/Patient/${patientToDelete}`);
      patients = fetchPatients(page, searchTerm);
    } catch (error) {
      console.error("Error deleting patient:", error);
    }
    showDeleteDialog = false;
    patientToDelete = undefined;
  };

  onMount(() => {
    patients = fetchPatients(page, searchTerm);
  });

  $: patients = fetchPatients(page, searchTerm);
</script>

<div class="px-6 sm:px-10 lg:px-16 xl:px-24">
  <p class="mb-4">
    <a class="p-2 bg-royal-blue text-white text-lg rounded" href="/patient">Create Patient</a>
  </p>
  <h1 class="text-3xl font-semibold mb-4 text-royal-blue">Patients on the Medblocks FHIR Server</h1>
  
  <div class="flex items-center gap-4 mb-4">
    <input 
      bind:this={searchInput}
      on:keyup={(e) => debounce(e.target)} 
      class="w-full border p-2 text-lg" 
      placeholder="Search by name or phone number"
    >
    {#if isSearching}
      <button 
        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        on:click={returnToFullList}>
        Return to Full List
      </button>
    {/if}
  </div>

  <table class="min-w-full divide-y divide-gray-300 text-lg">
    <thead>
      <tr class="bg-gray-100">
        <th class="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
        <th class="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Gender</th>
        <th class="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Date of Birth</th>
        <th class="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
        <th class="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-300">
      {#await patients}
        <tr>
          <td colspan="5" class="px-6 py-4 text-center">Loading...</td>
        </tr>
      {:then patientBundle}
        {#each patientBundle?.entry || [] as patient}
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">{formatName(patient?.resource)}</td>
            <td class="px-6 py-4 whitespace-nowrap">{patient?.resource?.gender || 'Unknown'}</td>
            <td class="px-6 py-4 whitespace-nowrap">{patient?.resource?.birthDate || 'Unknown'}</td>
            <td class="px-6 py-4 whitespace-nowrap">{new Date(patient?.resource?.meta?.lastUpdated).toLocaleDateString()}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <button class="bg-royal-blue text-white px-2 py-1 rounded mr-2" on:click|stopPropagation={() => window.location.href = `/patient/${patient?.resource?.id}`}>Edit</button>
              <button class="bg-gray-700 text-white px-2 py-1 rounded" on:click|stopPropagation={() => confirmDelete(patient?.resource?.id)}>Delete</button>
            </td>
          </tr>
        {/each}
      {:catch error}
        <tr>
          <td colspan="5" class="px-6 py-4 text-center text-red-500">Error: {error.message}</td>
        </tr>
      {/await}
    </tbody>
  </table>

  <div class="mt-4">
    {#if page > 0}
      <button class="p-2 bg-gray-500 text-white text-lg rounded mr-2" on:click={() => page--}>Previous</button>
    {/if}
    <button class="p-2 bg-black text-white text-lg rounded" on:click={() => page++}>Next</button>
  </div>

  {#if showDeleteDialog}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <p class="mb-4 text-lg">Are you sure you want to delete this patient?</p>
        <div class="flex justify-end">
          <button class="px-4 py-2 bg-gray-300 rounded mr-2" on:click={() => showDeleteDialog = false}>Cancel</button>
          <button class="px-4 py-2 bg-red-500 text-white rounded" on:click={handleDelete}>Delete</button>
        </div>
      </div>
    </div>
  {/if}
</div>
